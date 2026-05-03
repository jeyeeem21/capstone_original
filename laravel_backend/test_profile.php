<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->boot();

$user = \App\Models\User::where('role','customer')->first();
echo 'Customer: '.$user->email.PHP_EOL;

$req = \Illuminate\Http\Request::create('/api/auth/profile','PUT',[],[],[],[],json_encode(['first_name'=>'Test','last_name'=>'User']));
$req->headers->set('Content-Type','application/json');
$req->setUserResolver(fn() => $user);

$ctrl = $app->make(\App\Http\Controllers\AuthController::class);

try {
  $resp = $ctrl->updateProfile($req);
  echo $resp->getContent().PHP_EOL;
} catch(\Throwable $e) {
  echo 'ERROR: '.$e->getMessage().PHP_EOL;
  echo $e->getFile().':'.$e->getLine().PHP_EOL;
  echo $e->getTraceAsString().PHP_EOL;
}
