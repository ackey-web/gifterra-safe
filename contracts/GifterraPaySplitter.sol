// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/finance/PaymentSplitter.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GifterraPaySplitter v1.0.1
 * @notice 支払いの受け口 + 分配 + イベント発火を担うコントラクト
 *
 * 【目的】
 * - 支払い（ETH/MATIC および ERC20）の受領
 * - 収益の自動分配（シェア固定）
 * - Distributor やバックエンドが購読できるイベントの発火
 * - この段階では Distributor との直接連携（自動ミント呼び出し）は入れない
 *
 * 【設計】
 * - OpenZeppelin PaymentSplitter をベース
 * - Pausable / ReentrancyGuard 付与
 * - ネイティブ（MATIC/ETH）と ERC20 の両方に対応
 * - 受け口関数：donateNative / donateERC20
 * - イベント：DonationReceived（将来変更しない前提で固定）
 *
 * 【役割分離】
 * - このコントラクト：支払い受け口・分配・イベント発火
 * - GifterraDistributor：イベント購読・ルール判定・自動配布実行（将来実装）
 * - RewardNFT / SBT：NFT発行（自動配布の実行先）
 *
 * 【セキュリティ】
 * - Pausable：donate 関数は pause 中に revert
 * - ReentrancyGuard：donate / release 系に適用
 * - 0 金額・不正トークン・自分宛送金などのハードニング
 *
 * 【バージョン履歴】
 * v1.0.1 (最終調整):
 * - receive() 関数の修正: super.receive() 削除（Solidity仕様違反）
 *   → pause対応 + イベント発火に変更（pause機能の一貫性確保）
 * - _getPayeeCount() にガスコスト警告を追加
 * - OpenZeppelin バージョン依存（totalReleased系）の注記を追加
 * v1.0.0 (初回リリース):
 * - 基本機能実装（donateNative/ERC20, releaseAll系, pause機能）
 */
contract GifterraPaySplitter is PaymentSplitter, Pausable, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ========================================
    // イベント（購読用・将来変更しない前提で固定）
    // ========================================

    /**
     * @notice 寄付受領イベント
     * @dev Distributor やバックエンドが購読する重要イベント
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

    // ========================================
    // コンストラクタ
    // ========================================

    /**
     * @notice コンストラクタ
     * @dev OpenZeppelin PaymentSplitter の仕様に従い、payees と shares を設定
     * @param payees_ 受益者アドレスの配列
     * @param shares_ 各受益者のシェア配列（合計は任意、比率のみ重要）
     */
    constructor(
        address[] memory payees_,
        uint256[] memory shares_
    ) PaymentSplitter(payees_, shares_) {
        require(payees_.length > 0, "No payees provided");
        require(payees_.length == shares_.length, "Payees and shares length mismatch");
    }

    // ========================================
    // 受け口関数（ネイティブ通貨）
    // ========================================

    /**
     * @notice ネイティブ通貨（MATIC/ETH）の寄付受け口
     * @dev msg.value > 0 であること。受領後に DonationReceived を emit
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

        // PaymentSplitter は payable receive() で自動的にネイティブ通貨を受領
        // ここでは追加のイベント emit のみ行う
        emit DonationReceived(msg.sender, address(0), msg.value, sku, traceId);
    }

    /**
     * @notice ネイティブ通貨のフォールバック受領
     * @dev 直接送金された場合もPaymentSplitterの残高に追加される
     *      v1.0.1: pause対応 + イベント発火（sku/traceIdは空）
     *      理由: pause機能の一貫性を保ち、全ての入金を追跡可能にするため
     */
    receive() external payable override whenNotPaused nonReentrant {
        require(msg.value > 0, "Donation amount must be greater than 0");

        // イベント発火（sku と traceId は空）
        // 直接送金の場合は商品情報がないため、bytes32(0) を使用
        emit DonationReceived(msg.sender, address(0), msg.value, bytes32(0), bytes32(0));
    }

    // ========================================
    // 受け口関数（ERC20）
    // ========================================

    /**
     * @notice ERC20 トークンの寄付受け口
     * @dev 事前に approve が必要。safeTransferFrom で pull する
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

        // トークンを pull（事前に approve が必要）
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // イベント発火
        emit DonationReceived(msg.sender, token, amount, sku, traceId);
    }

    // ========================================
    // 分配関数（ユーティリティ追加）
    // ========================================

    /**
     * @notice 全受益者にネイティブ通貨を分配
     * @dev PaymentSplitter.release() を全 payee に対して実行
     */
    function releaseAll() external nonReentrant {
        uint256 payeeCount = _getPayeeCount();
        require(payeeCount > 0, "No payees to release");

        for (uint256 i = 0; i < payeeCount; i++) {
            address payable payee = payable(_getPayee(i));
            // release() は内部で releasable() > 0 をチェックするため安全
            if (_releasableNative(payee) > 0) {
                release(payee);
            }
        }
    }

    /**
     * @notice 全受益者に指定 ERC20 トークンを分配
     * @dev PaymentSplitter.release(IERC20,address) を全 payee に対して実行
     * @param token 分配する ERC20 トークンアドレス
     */
    function releaseAllERC20(IERC20 token) external nonReentrant {
        require(address(token) != address(0), "Invalid token address");

        uint256 payeeCount = _getPayeeCount();
        require(payeeCount > 0, "No payees to release");

        for (uint256 i = 0; i < payeeCount; i++) {
            address payee = _getPayee(i);
            // release() は内部で releasable() > 0 をチェックするため安全
            if (_releasableERC20(token, payee) > 0) {
                release(token, payee);
            }
        }
    }

    // ========================================
    // Pause 機能
    // ========================================

    /**
     * @notice コントラクトを一時停止
     * @dev donate 関数が revert する
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice コントラクトの一時停止を解除
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ========================================
    // 内部ヘルパー関数
    // ========================================

    /**
     * @notice 受益者数を取得
     * @dev PaymentSplitter の内部状態から取得
     * @dev ⚠️ ガスコスト警告：try-catch ループのため、payee数に比例してガスコストが増加
     *      オンチェーン運用では多用を避け、運用ツールやバックエンドからの限定的呼び出しに留めること
     *      設計意図：releaseAll() などの管理操作用（頻繁な呼び出しは想定外）
     */
    function _getPayeeCount() internal view returns (uint256) {
        // PaymentSplitter は payee(uint256 index) を提供
        // 総数は直接取得できないため、試行錯誤で判定
        uint256 count = 0;
        while (true) {
            try this.payee(count) returns (address) {
                count++;
            } catch {
                break;
            }
        }
        return count;
    }

    /**
     * @notice インデックスから受益者アドレスを取得
     * @dev PaymentSplitter.payee(index) のラッパー
     */
    function _getPayee(uint256 index) internal view returns (address) {
        return payee(index);
    }

    /**
     * @notice ネイティブ通貨の releasable 金額を取得
     * @dev PaymentSplitter.releasable(address) のラッパー
     */
    function _releasableNative(address account) internal view returns (uint256) {
        uint256 totalReceived = address(this).balance + totalReleased();
        uint256 accountShares = shares(account);
        uint256 totalShares_ = totalShares();
        uint256 payment = (totalReceived * accountShares) / totalShares_ - released(account);
        return payment;
    }

    /**
     * @notice ERC20 トークンの releasable 金額を取得
     * @dev PaymentSplitter.releasable(IERC20,address) のラッパー
     */
    function _releasableERC20(IERC20 token, address account) internal view returns (uint256) {
        uint256 totalReceived = token.balanceOf(address(this)) + totalReleased(token);
        uint256 accountShares = shares(account);
        uint256 totalShares_ = totalShares();
        uint256 payment = (totalReceived * accountShares) / totalShares_ - released(token, account);
        return payment;
    }

    // ========================================
    // View 関数（統計・デバッグ用）
    // ========================================

    /**
     * @notice コントラクトの基本情報を取得
     * @dev ⚠️ OpenZeppelin 依存：totalReleased() は OZ v4.7+ で追加された関数
     *      古いバージョンでは代替として released(payee) を全員分合計する必要がある
     * @return payeeCount 受益者数
     * @return totalShares_ 総シェア数
     * @return nativeBalance ネイティブ通貨残高
     * @return totalNativeReleased 累計ネイティブ通貨分配額
     * @return isPaused 一時停止状態
     */
    function getStats()
        external
        view
        returns (
            uint256 payeeCount,
            uint256 totalShares_,
            uint256 nativeBalance,
            uint256 totalNativeReleased,
            bool isPaused
        )
    {
        payeeCount = _getPayeeCount();
        totalShares_ = totalShares();
        nativeBalance = address(this).balance;
        totalNativeReleased = totalReleased();
        isPaused = paused();
    }

    /**
     * @notice 指定 ERC20 トークンの統計情報を取得
     * @dev ⚠️ OpenZeppelin 依存：totalReleased(token) は OZ v4.7+ で追加された関数
     *      古いバージョンでは代替として released(token, payee) を全員分合計する必要がある
     * @param token ERC20 トークンアドレス
     * @return tokenBalance トークン残高
     * @return totalTokenReleased 累計トークン分配額
     */
    function getERC20Stats(IERC20 token)
        external
        view
        returns (uint256 tokenBalance, uint256 totalTokenReleased)
    {
        require(address(token) != address(0), "Invalid token address");
        tokenBalance = token.balanceOf(address(this));
        totalTokenReleased = totalReleased(token);
    }

    /**
     * @notice 受益者の分配可能額を取得（ネイティブ通貨）
     * @param account 受益者アドレス
     * @return releasableAmount 分配可能額
     */
    function getReleasableNative(address account)
        external
        view
        returns (uint256 releasableAmount)
    {
        return _releasableNative(account);
    }

    /**
     * @notice 受益者の分配可能額を取得（ERC20）
     * @param token ERC20 トークンアドレス
     * @param account 受益者アドレス
     * @return releasableAmount 分配可能額
     */
    function getReleasableERC20(IERC20 token, address account)
        external
        view
        returns (uint256 releasableAmount)
    {
        return _releasableERC20(token, account);
    }

    /**
     * @notice バージョン情報
     */
    function version() external pure returns (string memory) {
        return "GifterraPaySplitter v1.0.1 - Payment Receiver + Distribution + Event Emitter (Solidity Compliance Update)";
    }
}
