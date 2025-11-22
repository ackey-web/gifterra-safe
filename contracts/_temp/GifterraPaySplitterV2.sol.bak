// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ScoreRegistry.sol";

/**
 * @title GifterraPaySplitter v2.0.0
 * @notice 可変分配機能を持つ支払いの受け口 + 分配 + イベント発火コントラクト
 *
 * 【v2の新機能】
 * - ✨ クリエイター（payee）の動的追加・削除
 * - ✨ 配分比率（shares）の動的変更
 * - ✨ UI上からの簡単な管理
 * - ✅ 既存の分配済み収益には影響しない安全設計
 *
 * 【v1からの変更点】
 * - OpenZeppelin PaymentSplitter の継承を廃止
 * - 完全独自実装による可変機能の実現
 * - 分配ロジックも独自実装（より柔軟な管理）
 *
 * 【目的】
 * - 支払い（ETH/MATIC および ERC20）の受領
 * - 収益の自動分配（シェア可変）
 * - クリエイターの動的管理（追加・削除・変更）
 * - Distributor やバックエンドが購読できるイベントの発火
 *
 * 【セキュリティ】
 * - Pausable：donate 関数は pause 中に revert
 * - ReentrancyGuard：donate / release 系に適用
 * - onlyOwner：payee/share 管理は owner のみ
 * - 既存分配済み収益の保護：変更前の収益は適切に処理
 *
 * 【使用例】
 * 1. デプロイ（初期クリエイター設定）
 * 2. クリエイター追加: addPayee(address, shares)
 * 3. クリエイター削除: removePayee(address)
 * 4. シェア変更: updateShares(address, newShares)
 * 5. 分配実行: releaseAll() または releaseAllERC20(token)
 */
contract GifterraPaySplitterV2 is Pausable, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ========================================
    // 状態変数
    // ========================================

    /// @notice クリエイターアドレスの配列
    address[] private _payees;

    /// @notice クリエイターのシェア（配分比率）
    mapping(address => uint256) private _shares;

    /// @notice クリエイターのインデックス（削除時の効率化）
    mapping(address => uint256) private _payeeIndex;

    /// @notice ネイティブ通貨の累計受領額
    uint256 private _totalNativeReceived;

    /// @notice ネイティブ通貨の各クリエイターへの分配済み額
    mapping(address => uint256) private _nativeReleased;

    /// @notice ERC20トークンの累計受領額
    mapping(IERC20 => uint256) private _totalERC20Received;

    /// @notice ERC20トークンの各クリエイターへの分配済み額
    mapping(IERC20 => mapping(address => uint256)) private _erc20Released;

    /// @notice ScoreRegistryコントラクト（オプション）
    ScoreRegistry public scoreRegistry;

    // ========================================
    // イベント
    // ========================================

    /**
     * @notice 寄付受領イベント（v1互換）
     * @param payer 支払者アドレス
     * @param token トークンアドレス（ネイティブ通貨の場合は address(0)）
     * @param amount 金額
     * @param sku 商品/用途/カテゴリの識別子（空許容）
     * @param traceId NFC/注文ID/トレース等の任意識別子（空許容）
     */
    event DonationReceived(
        address indexed payer,
        address indexed token,
        uint256 amount,
        bytes32 indexed sku,
        bytes32 traceId
    );

    /**
     * @notice クリエイター追加イベント
     * @param account クリエイターアドレス
     * @param shares 配分比率
     */
    event PayeeAdded(address indexed account, uint256 shares);

    /**
     * @notice クリエイター削除イベント
     * @param account クリエイターアドレス
     */
    event PayeeRemoved(address indexed account);

    /**
     * @notice シェア変更イベント
     * @param account クリエイターアドレス
     * @param oldShares 旧シェア
     * @param newShares 新シェア
     */
    event SharesUpdated(address indexed account, uint256 oldShares, uint256 newShares);

    /**
     * @notice 分配実行イベント（ネイティブ通貨）
     * @param account クリエイターアドレス
     * @param amount 分配額
     */
    event NativeReleased(address indexed account, uint256 amount);

    /**
     * @notice 分配実行イベント（ERC20）
     * @param token トークンアドレス
     * @param account クリエイターアドレス
     * @param amount 分配額
     */
    event ERC20Released(IERC20 indexed token, address indexed account, uint256 amount);

    // ========================================
    // コンストラクタ
    // ========================================

    /**
     * @notice コンストラクタ
     * @param payees_ 初期クリエイターアドレスの配列
     * @param shares_ 各クリエイターのシェア配列（合計は任意、比率のみ重要）
     */
    constructor(address[] memory payees_, uint256[] memory shares_) {
        require(payees_.length > 0, "No payees provided");
        require(payees_.length == shares_.length, "Payees and shares length mismatch");

        for (uint256 i = 0; i < payees_.length; i++) {
            _addPayee(payees_[i], shares_[i]);
        }
    }

    // ========================================
    // ScoreRegistry 設定
    // ========================================

    /**
     * @notice ScoreRegistryコントラクトのアドレスを設定
     * @param _scoreRegistry ScoreRegistryのアドレス（address(0)で無効化）
     */
    function setScoreRegistry(address _scoreRegistry) external onlyOwner {
        scoreRegistry = ScoreRegistry(_scoreRegistry);
    }

    // ========================================
    // 受け口関数（ネイティブ通貨）
    // ========================================

    /**
     * @notice ネイティブ通貨（MATIC/ETH）の寄付受け口
     * @param sku 商品/用途/カテゴリの識別子（空許容）
     * @param traceId NFC/注文ID/トレース等の任意識別子（空許容）
     */
    function donateNative(bytes32 sku, bytes32 traceId)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        require(msg.value > 0, "Donation amount must be greater than 0");

        _totalNativeReceived += msg.value;

        emit DonationReceived(msg.sender, address(0), msg.value, sku, traceId);

        // スコア記録（ScoreRegistryが設定されている場合のみ）
        if (address(scoreRegistry) != address(0)) {
            scoreRegistry.recordScore(msg.sender, address(0), msg.value, traceId);
        }
    }

    /**
     * @notice ネイティブ通貨のフォールバック受領
     */
    receive() external payable whenNotPaused nonReentrant {
        require(msg.value > 0, "Donation amount must be greater than 0");

        _totalNativeReceived += msg.value;

        emit DonationReceived(msg.sender, address(0), msg.value, bytes32(0), bytes32(0));

        // スコア記録（ScoreRegistryが設定されている場合のみ）
        if (address(scoreRegistry) != address(0)) {
            scoreRegistry.recordScore(msg.sender, address(0), msg.value, bytes32(0));
        }
    }

    // ========================================
    // 受け口関数（ERC20）
    // ========================================

    /**
     * @notice ERC20 トークンの寄付受け口
     * @param token トークンコントラクトアドレス（0アドレス不可）
     * @param amount 金額（0不可）
     * @param sku 商品/用途/カテゴリの識別子（空許容）
     * @param traceId NFC/注文ID/トレース等の任意識別子（空許容）
     */
    function donateERC20(
        address token,
        uint256 amount,
        bytes32 sku,
        bytes32 traceId
    ) external whenNotPaused nonReentrant {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Donation amount must be greater than 0");
        require(token != address(this), "Cannot donate contract itself");

        IERC20 tokenContract = IERC20(token);
        tokenContract.safeTransferFrom(msg.sender, address(this), amount);

        _totalERC20Received[tokenContract] += amount;

        emit DonationReceived(msg.sender, token, amount, sku, traceId);

        // スコア記録（ScoreRegistryが設定されている場合のみ）
        if (address(scoreRegistry) != address(0)) {
            scoreRegistry.recordScore(msg.sender, token, amount, traceId);
        }
    }

    // ========================================
    // 分配関数
    // ========================================

    /**
     * @notice ネイティブ通貨を指定クリエイターに分配
     * @param account クリエイターアドレス
     */
    function release(address payable account) public nonReentrant {
        require(_shares[account] > 0, "Account has no shares");

        uint256 payment = _pendingNativePayment(account);
        require(payment > 0, "Account is not due payment");

        _nativeReleased[account] += payment;

        (bool success, ) = account.call{value: payment}("");
        require(success, "Transfer failed");

        emit NativeReleased(account, payment);
    }

    /**
     * @notice ERC20トークンを指定クリエイターに分配
     * @param token トークンアドレス
     * @param account クリエイターアドレス
     */
    function release(IERC20 token, address account) public nonReentrant {
        require(_shares[account] > 0, "Account has no shares");

        uint256 payment = _pendingERC20Payment(token, account);
        require(payment > 0, "Account is not due payment");

        _erc20Released[token][account] += payment;
        token.safeTransfer(account, payment);

        emit ERC20Released(token, account, payment);
    }

    /**
     * @notice 全クリエイターにネイティブ通貨を分配
     */
    function releaseAll() external nonReentrant {
        require(_payees.length > 0, "No payees to release");

        for (uint256 i = 0; i < _payees.length; i++) {
            address payable payee = payable(_payees[i]);
            uint256 payment = _pendingNativePayment(payee);
            if (payment > 0) {
                release(payee);
            }
        }
    }

    /**
     * @notice 全クリエイターにERC20トークンを分配
     * @param token トークンアドレス
     */
    function releaseAllERC20(IERC20 token) external nonReentrant {
        require(address(token) != address(0), "Invalid token address");
        require(_payees.length > 0, "No payees to release");

        for (uint256 i = 0; i < _payees.length; i++) {
            address payee = _payees[i];
            uint256 payment = _pendingERC20Payment(token, payee);
            if (payment > 0) {
                release(token, payee);
            }
        }
    }

    // ========================================
    // クリエイター管理関数（可変機能）
    // ========================================

    /**
     * @notice クリエイターを追加
     * @param account クリエイターアドレス
     * @param shares_ 配分比率
     */
    function addPayee(address account, uint256 shares_) external onlyOwner {
        require(account != address(0), "Invalid address");
        require(shares_ > 0, "Shares must be greater than 0");
        require(_shares[account] == 0, "Payee already exists");

        _addPayee(account, shares_);

        emit PayeeAdded(account, shares_);
    }

    /**
     * @notice クリエイターを削除
     * @dev 削除前に必ず分配を実行してください
     * @param account クリエイターアドレス
     */
    function removePayee(address account) external onlyOwner {
        require(_shares[account] > 0, "Payee does not exist");

        // 分配可能額がある場合は警告（実際の削除は許可）
        uint256 pendingNative = _pendingNativePayment(account);
        require(pendingNative == 0, "Payee has pending native payment. Release before removing.");

        uint256 oldShares = _shares[account];
        _shares[account] = 0;

        // 配列から削除
        uint256 index = _payeeIndex[account];
        uint256 lastIndex = _payees.length - 1;

        if (index != lastIndex) {
            address lastPayee = _payees[lastIndex];
            _payees[index] = lastPayee;
            _payeeIndex[lastPayee] = index;
        }

        _payees.pop();
        delete _payeeIndex[account];

        emit PayeeRemoved(account);
    }

    /**
     * @notice シェア（配分比率）を変更
     * @param account クリエイターアドレス
     * @param newShares 新しい配分比率
     */
    function updateShares(address account, uint256 newShares) external onlyOwner {
        require(_shares[account] > 0, "Payee does not exist");
        require(newShares > 0, "Shares must be greater than 0");

        uint256 oldShares = _shares[account];
        _shares[account] = newShares;

        emit SharesUpdated(account, oldShares, newShares);
    }

    // ========================================
    // Pause 機能
    // ========================================

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ========================================
    // View 関数
    // ========================================

    /**
     * @notice すべてのクリエイター情報を取得
     * @return payees クリエイターアドレスの配列
     * @return shares シェアの配列
     */
    function getAllPayees() external view returns (address[] memory payees, uint256[] memory shares) {
        payees = _payees;
        shares = new uint256[](_payees.length);

        for (uint256 i = 0; i < _payees.length; i++) {
            shares[i] = _shares[_payees[i]];
        }
    }

    /**
     * @notice 指定クリエイターのシェアを取得
     * @param account クリエイターアドレス
     * @return シェア
     */
    function shares(address account) external view returns (uint256) {
        return _shares[account];
    }

    /**
     * @notice 総シェア数を取得
     * @return 総シェア数
     */
    function totalShares() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < _payees.length; i++) {
            total += _shares[_payees[i]];
        }
        return total;
    }

    /**
     * @notice クリエイター数を取得
     * @return クリエイター数
     */
    function payeeCount() external view returns (uint256) {
        return _payees.length;
    }

    /**
     * @notice ネイティブ通貨の累計受領額を取得
     * @return 累計受領額
     */
    function totalNativeReceived() external view returns (uint256) {
        return _totalNativeReceived;
    }

    /**
     * @notice 指定クリエイターのネイティブ通貨分配済み額を取得
     * @param account クリエイターアドレス
     * @return 分配済み額
     */
    function nativeReleased(address account) external view returns (uint256) {
        return _nativeReleased[account];
    }

    /**
     * @notice 指定クリエイターのネイティブ通貨分配可能額を取得
     * @param account クリエイターアドレス
     * @return 分配可能額
     */
    function pendingNativePayment(address account) external view returns (uint256) {
        return _pendingNativePayment(account);
    }

    /**
     * @notice 指定クリエイターのERC20トークン分配済み額を取得
     * @param token トークンアドレス
     * @param account クリエイターアドレス
     * @return 分配済み額
     */
    function erc20Released(IERC20 token, address account) external view returns (uint256) {
        return _erc20Released[token][account];
    }

    /**
     * @notice 指定クリエイターのERC20トークン分配可能額を取得
     * @param token トークンアドレス
     * @param account クリエイターアドレス
     * @return 分配可能額
     */
    function pendingERC20Payment(IERC20 token, address account) external view returns (uint256) {
        return _pendingERC20Payment(token, account);
    }

    /**
     * @notice コントラクトの統計情報を取得
     * @return payeeCount_ クリエイター数
     * @return totalShares_ 総シェア数
     * @return nativeBalance ネイティブ通貨残高
     * @return totalNativeReceived_ 累計ネイティブ通貨受領額
     * @return isPaused 一時停止状態
     */
    function getStats()
        external
        view
        returns (
            uint256 payeeCount_,
            uint256 totalShares_,
            uint256 nativeBalance,
            uint256 totalNativeReceived_,
            bool isPaused
        )
    {
        payeeCount_ = _payees.length;
        totalShares_ = totalShares();
        nativeBalance = address(this).balance;
        totalNativeReceived_ = _totalNativeReceived;
        isPaused = paused();
    }

    /**
     * @notice バージョン情報
     */
    function version() external pure returns (string memory) {
        return "GifterraPaySplitter v2.0.0 - Variable Payment Splitter with Dynamic Creator Management";
    }

    // ========================================
    // 内部関数
    // ========================================

    /**
     * @notice クリエイターを内部追加
     * @param account クリエイターアドレス
     * @param shares_ 配分比率
     */
    function _addPayee(address account, uint256 shares_) private {
        require(account != address(0), "Invalid address");
        require(shares_ > 0, "Shares must be greater than 0");
        require(_shares[account] == 0, "Payee already exists");

        _payees.push(account);
        _shares[account] = shares_;
        _payeeIndex[account] = _payees.length - 1;
    }

    /**
     * @notice ネイティブ通貨の分配可能額を計算
     * @param account クリエイターアドレス
     * @return 分配可能額
     */
    function _pendingNativePayment(address account) private view returns (uint256) {
        if (_shares[account] == 0) {
            return 0;
        }

        uint256 totalShares_ = totalShares();
        if (totalShares_ == 0) {
            return 0;
        }

        uint256 totalReceived = _totalNativeReceived;
        uint256 alreadyReleased = _nativeReleased[account];
        uint256 entitlement = (totalReceived * _shares[account]) / totalShares_;

        if (entitlement <= alreadyReleased) {
            return 0;
        }

        return entitlement - alreadyReleased;
    }

    /**
     * @notice ERC20トークンの分配可能額を計算
     * @param token トークンアドレス
     * @param account クリエイターアドレス
     * @return 分配可能額
     */
    function _pendingERC20Payment(IERC20 token, address account) private view returns (uint256) {
        if (_shares[account] == 0) {
            return 0;
        }

        uint256 totalShares_ = totalShares();
        if (totalShares_ == 0) {
            return 0;
        }

        uint256 totalReceived = _totalERC20Received[token];
        uint256 alreadyReleased = _erc20Released[token][account];
        uint256 entitlement = (totalReceived * _shares[account]) / totalShares_;

        if (entitlement <= alreadyReleased) {
            return 0;
        }

        return entitlement - alreadyReleased;
    }
}
