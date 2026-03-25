<?php
/**
 * 本番サーバー用：このファイルをコピーして mail-config.php を作成し、値を編集してください。
 * mail-config.php は Git に含めないことを推奨します（.gitignore に記載済み）。
 *
 * mail-config.php が無い場合は mail.php 内の既定値が使われます。
 */
declare(strict_types=1);

return [
    // 管理者通知の宛先
    'admin_to' => 'amao0423@hotseller.co.kr',

    // 送信元（From）— サーバーで送信が許可されたドメインのメールを指定してください
    'from_email' => 'amao0423@hotseller.co.kr',
    'from_name' => 'JEMIA',

    // 件名（管理者通知）
    'admin_subject' => '【JEMIA】新規お問い合わせ/診断申し込みがありました',

    // 10分あたりの同一セッションからの最大送信回数（スパム緩和。0 で無効）
    'rate_limit_max' => 6,
    'rate_limit_window_seconds' => 600,
];
