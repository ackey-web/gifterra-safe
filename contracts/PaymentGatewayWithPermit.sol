// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title IERC2612
 * @dev ERC-2612 Permit拡張インターフェース
 */
interface IERC2612 {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);

    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title PaymentGatewayWithPermit
 * @dev ERC-2612 Permit機能を使ったガスレス決済ゲートウェイ
 *
 * 特徴:
 * - ユーザーはガス代を支払わずに決済を実行可能
 * - Permitシグネチャで承認とトランザクションを分離
 * - リプレイアタック防止（requestId管理）
 * - セキュアな決済処理（ReentrancyGuard、Pausable）
 */
contract PaymentGatewayWithPermit is Ownable, ReentrancyGuard, Pausable {
    // JPYC トークンコントラクト
    IERC2612 public jpyc;

    // プラットフォーム手数料率（基数: 10000 = 100%）
    uint256 public platformFeeRate = 0; // デフォルト0%（後で設定可能）

    // プラットフォーム手数料受取アドレス
    address public platformFeeRecipient;

    // 処理済みリクエストID（リプレイアタック防止）
    mapping(bytes32 => bool) public processedRequests;

    // イベント
    event PaymentExecuted(
        bytes32 indexed requestId,
        address indexed payer,
        address indexed merchant,
        uint256 amount,
        uint256 platformFee,
        uint256 timestamp
    );

    event PlatformFeeRateUpdated(uint256 oldRate, uint256 newRate);
    event PlatformFeeRecipientUpdated(address oldRecipient, address newRecipient);

    /**
     * @dev コンストラクタ
     * @param _jpycAddress JPYCトークンアドレス
     * @param _platformFeeRecipient プラットフォーム手数料受取アドレス
     */
    constructor(address _jpycAddress, address _platformFeeRecipient) {
        require(_jpycAddress != address(0), "Invalid JPYC address");
        require(_platformFeeRecipient != address(0), "Invalid fee recipient");

        jpyc = IERC2612(_jpycAddress);
        platformFeeRecipient = _platformFeeRecipient;
    }

    /**
     * @dev Permitを使ったガスレス決済実行
     * @param requestId リクエストID（リプレイアタック防止用、QRコードに含まれる）
     * @param merchant 受取人アドレス
     * @param amount 支払い金額（wei単位）
     * @param deadline Permit有効期限
     * @param v ECDSA署名のv値
     * @param r ECDSA署名のr値
     * @param s ECDSA署名のs値
     */
    function executePaymentWithPermit(
        bytes32 requestId,
        address merchant,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused {
        // 1. リクエストID重複チェック（リプレイアタック防止）
        require(!processedRequests[requestId], "Request already processed");
        require(merchant != address(0), "Invalid merchant address");
        require(amount > 0, "Amount must be greater than 0");
        require(block.timestamp <= deadline, "Permit expired");

        // 2. リクエストIDを処理済みとしてマーク
        processedRequests[requestId] = true;

        // 3. PermitでApproveをガスレスで実行
        // msg.senderがpayerとなる（支払い実行者 = Relayer）
        // しかし、Permitのownerは実際の支払い元ユーザー
        // 注意: Permit内部でownerが検証される
        jpyc.permit(tx.origin, address(this), amount, deadline, v, r, s);

        // 4. プラットフォーム手数料計算
        uint256 platformFee = (amount * platformFeeRate) / 10000;
        uint256 merchantAmount = amount - platformFee;

        // 5. 残高確認
        require(jpyc.balanceOf(tx.origin) >= amount, "Insufficient balance");

        // 6. transferFromで決済実行
        // tx.origin = 実際の支払い元ユーザー（Permitのowner）
        // merchant = 受取人
        require(
            jpyc.transferFrom(tx.origin, merchant, merchantAmount),
            "Transfer to merchant failed"
        );

        // 7. プラットフォーム手数料を送金（手数料が0より大きい場合のみ）
        if (platformFee > 0) {
            require(
                jpyc.transferFrom(tx.origin, platformFeeRecipient, platformFee),
                "Transfer platform fee failed"
            );
        }

        // 8. イベント発行
        emit PaymentExecuted(
            requestId,
            tx.origin,
            merchant,
            amount,
            platformFee,
            block.timestamp
        );
    }

    /**
     * @dev プラットフォーム手数料率を更新（オーナーのみ）
     * @param newFeeRate 新しい手数料率（基数: 10000 = 100%）
     * 例: 250 = 2.5%, 100 = 1%, 0 = 0%
     */
    function setPlatformFeeRate(uint256 newFeeRate) external onlyOwner {
        require(newFeeRate <= 1000, "Fee rate too high (max 10%)");
        uint256 oldRate = platformFeeRate;
        platformFeeRate = newFeeRate;
        emit PlatformFeeRateUpdated(oldRate, newFeeRate);
    }

    /**
     * @dev プラットフォーム手数料受取アドレスを更新（オーナーのみ）
     * @param newRecipient 新しい受取アドレス
     */
    function setPlatformFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        address oldRecipient = platformFeeRecipient;
        platformFeeRecipient = newRecipient;
        emit PlatformFeeRecipientUpdated(oldRecipient, newRecipient);
    }

    /**
     * @dev コントラクトを一時停止（オーナーのみ）
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev コントラクトの一時停止を解除（オーナーのみ）
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev リクエストIDが処理済みかチェック
     * @param requestId チェック対象のリクエストID
     * @return 処理済みの場合true
     */
    function isRequestProcessed(bytes32 requestId) external view returns (bool) {
        return processedRequests[requestId];
    }
}
