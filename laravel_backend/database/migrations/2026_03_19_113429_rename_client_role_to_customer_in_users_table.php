<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->where('role', 'client')->update(['role' => 'customer']);
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'customer')->update(['role' => 'client']);
    }
};
