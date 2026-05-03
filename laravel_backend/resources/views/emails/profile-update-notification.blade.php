<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7f0518; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .changes { background: white; padding: 15px; border-left: 4px solid #7f0518; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Profile Updated</h2>
        </div>
        <div class="content">
            <p>Hello <strong>{{ $userName }}</strong>,</p>
            <p>Your profile has been updated successfully.</p>
            
            <div class="changes">
                <h3>Changes Made:</h3>
                <ul>
                    @foreach($changes as $field => $value)
                        <li><strong>{{ ucfirst(str_replace('_', ' ', $field)) }}:</strong> {{ $value }}</li>
                    @endforeach
                </ul>
            </div>
            
            <p><strong>IP Address:</strong> {{ $ipAddress }}</p>
            <p><strong>Time:</strong> {{ now()->format('F j, Y g:i A') }}</p>
            
            <p>If you did not make this change, please contact your administrator immediately.</p>
        </div>
        <div class="footer">
            <p>This is an automated message from {{ \App\Models\BusinessSetting::getValue('business_name', config('app.name')) }} Management System.</p>
        </div>
    </div>
</body>
</html>
