@php
    $businessName = \App\Models\BusinessSetting::getValue('business_name', config('app.name'));
    $businessTagline = \App\Models\BusinessSetting::getValue('footer_tagline', 'Quality Rice, Quality Service');
    $footerCopyright = \App\Models\BusinessSetting::getValue('footer_copyright', 'All rights reserved.');

    $appearance = \App\Models\AppearanceSetting::getAllAsKeyValue();
    $headerColor = $appearance['button_primary'] ?? '#7f0518';
    $headerColorLight = ($appearance['hover_color'] ?? '#b22e5c');
    $bodyBg = $appearance['bg_body'] ?? '#f3f4f6';
    $contentBg = $appearance['bg_primary'] ?? '#ffffff';
    $textColor = $appearance['text_primary'] ?? '#1f2937';
    $textMuted = $appearance['text_secondary'] ?? '#6b7280';
    $borderColor = $appearance['border_color'] ?? '#da2b2b';
    $footerBg = $appearance['bg_footer'] ?? '#111827';
    $footerText = '#ffffff';
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', $businessName)</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: {{ $bodyBg }};
            color: {{ $textColor }};
        }
        .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: {{ $contentBg }};
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .email-header {
            background: linear-gradient(135deg, {{ $headerColor }}, {{ $headerColorLight }});
            color: #ffffff;
            padding: 24px 32px;
            text-align: center;
        }
        .email-header h1 {
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
        .email-header p {
            margin: 4px 0 0;
            font-size: 13px;
            opacity: 0.85;
        }
        .email-body {
            padding: 32px;
        }
        .email-body h2 {
            margin: 0 0 16px;
            font-size: 20px;
            color: {{ $headerColor }};
        }
        .email-body p {
            margin: 0 0 12px;
            line-height: 1.6;
            font-size: 15px;
        }
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
        }
        .info-table th,
        .info-table td {
            padding: 10px 14px;
            text-align: left;
            border-bottom: 1px solid {{ $borderColor }}33;
            font-size: 14px;
        }
        .info-table th {
            background-color: {{ $headerColor }}0d;
            color: {{ $headerColor }};
            font-weight: 600;
            width: 40%;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .badge-success { background: #d4edda; color: #155724; }
        .badge-warning { background: #fff3cd; color: #856404; }
        .badge-info { background: #d1ecf1; color: #0c5460; }
        .badge-danger { background: #f8d7da; color: #721c24; }
        .badge-primary { background: {{ $headerColor }}1a; color: {{ $headerColor }}; }
        .email-footer {
            background-color: {{ $footerBg }};
            padding: 20px 32px;
            text-align: center;
            border-top: 1px solid {{ $borderColor }}33;
        }
        .email-footer p {
            margin: 0;
            font-size: 12px;
            color: {{ $footerText }};
        }
    </style>
</head>
<body>
    <div style="padding: 20px 10px;">
        <div class="email-wrapper">
            <div class="email-header">
                <h1>{{ $businessName }}</h1>
                <p>{{ $businessTagline }}</p>
            </div>
            <div class="email-body">
                @yield('content')
            </div>
            <div class="email-footer">
                <p>&copy; {{ date('Y') }} {{ $businessName }}. {{ $footerCopyright }}</p>
                <p style="margin-top: 4px;">This is an automated email. Please do not reply directly.</p>
            </div>
        </div>
    </div>
</body>
</html>
