<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DatabaseBackupController extends Controller
{
    use AuditLogger;

    /**
     * Export database as SQL file
     */
    public function export(Request $request)
    {
        $database = config('database.connections.mysql.database');
        $tables = $this->getTables();
        
        // Use business name from settings for filename
        $businessName = DB::table('business_settings')
            ->where('key', 'business_name')
            ->value('value') ?? 'KjpRicemill';
        $safeName = preg_replace('/[^a-zA-Z0-9]/', '', $businessName);
        $dateStr = date('F_j_Y');
        $filename = "{$safeName}_{$dateStr}_backup.sql";

        $this->logAudit('EXPORT', 'Database', "Exported database backup: {$filename}", [
            'filename' => $filename,
            'tables_count' => count($tables),
        ]);

        return new StreamedResponse(function () use ($tables, $database) {
            $handle = fopen('php://output', 'w');
            
            // Write header
            fwrite($handle, "-- Database Backup\n");
            fwrite($handle, "-- Database: {$database}\n");
            fwrite($handle, "-- Generated: " . date('Y-m-d H:i:s') . "\n");
            fwrite($handle, "-- PHP Version: " . phpversion() . "\n");
            fwrite($handle, "-- --------------------------------------------------------\n\n");
            fwrite($handle, "SET FOREIGN_KEY_CHECKS=0;\n");
            fwrite($handle, "SET SQL_MODE = \"NO_AUTO_VALUE_ON_ZERO\";\n");
            fwrite($handle, "SET time_zone = \"+00:00\";\n\n");
            
            foreach ($tables as $table) {
                // Get create table statement
                $createTable = DB::select("SHOW CREATE TABLE `{$table}`");
                if (!empty($createTable)) {
                    $createStatement = $createTable[0]->{'Create Table'};
                    
                    fwrite($handle, "-- --------------------------------------------------------\n");
                    fwrite($handle, "-- Table structure for table `{$table}`\n");
                    fwrite($handle, "-- --------------------------------------------------------\n\n");
                    fwrite($handle, "DROP TABLE IF EXISTS `{$table}`;\n");
                    fwrite($handle, $createStatement . ";\n\n");
                    
                    // Get table data using chunking to prevent memory exhaustion
                    $hasData = false;
                    DB::table($table)->orderBy(DB::raw('1'))->chunk(500, function ($rows) use ($handle, &$hasData, $table) {
                        if (!$hasData) {
                            fwrite($handle, "-- --------------------------------------------------------\n");
                            fwrite($handle, "-- Dumping data for table `{$table}`\n");
                            fwrite($handle, "-- --------------------------------------------------------\n\n");
                            $hasData = true;
                        }
                        
                        foreach ($rows as $row) {
                            $rowArray = (array) $row;
                            $columns = array_keys($rowArray);
                            $values = array_map(function ($value) {
                                if (is_null($value)) {
                                    return 'NULL';
                                }
                                return "'" . addslashes($value) . "'";
                            }, array_values($rowArray));
                            
                            $columnsList = '`' . implode('`, `', $columns) . '`';
                            $valuesList = implode(', ', $values);
                            
                            fwrite($handle, "INSERT INTO `{$table}` ({$columnsList}) VALUES ({$valuesList});\n");
                        }
                    });
                    if ($hasData) {
                        fwrite($handle, "\n");
                    }
                }
            }
            
            fwrite($handle, "SET FOREIGN_KEY_CHECKS=1;\n");
            fwrite($handle, "\n-- End of backup\n");
            
            fclose($handle);
        }, 200, [
            'Content-Type' => 'application/sql',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }
    
    /**
     * Get list of tables in the database
     */
    private function getTables(): array
    {
        $tables = DB::select('SHOW TABLES');
        
        if (empty($tables)) {
            return [];
        }
        
        // Get the first key dynamically since it varies based on database name
        $firstTable = (array) $tables[0];
        $tableKey = array_keys($firstTable)[0];
        
        return array_map(function ($table) use ($tableKey) {
            return $table->$tableKey;
        }, $tables);
    }
    
    /**
     * Get database info
     */
    public function info()
    {
        $database = config('database.connections.mysql.database');
        $tables = $this->getTables();
        
        $tableInfo = [];
        $totalSize = 0;
        $totalRows = 0;
        
        foreach ($tables as $table) {
            $count = DB::table($table)->count();
            $totalRows += $count;
            
            // Get table size
            $sizeQuery = DB::select("
                SELECT 
                    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
                FROM information_schema.tables 
                WHERE table_schema = ? AND table_name = ?
            ", [$database, $table]);
            
            $sizeMb = $sizeQuery[0]->size_mb ?? 0;
            $totalSize += $sizeMb;
            
            $tableInfo[] = [
                'name' => $table,
                'rows' => $count,
                'size' => $sizeMb . ' MB',
            ];
        }
        
        return response()->json([
            'database' => $database,
            'tables_count' => count($tables),
            'total_rows' => $totalRows,
            'total_size' => round($totalSize, 2) . ' MB',
            'tables' => $tableInfo,
        ]);
    }

    /**
     * Export all business data as a ZIP of CSV files
     */
    public function exportCsv(Request $request)
    {
        $businessName = DB::table('business_settings')
            ->where('key', 'business_name')
            ->value('value') ?? 'KjpRicemill';
        $safeName = preg_replace('/[^a-zA-Z0-9]/', '', $businessName);
        $dateStr = date('F_j_Y');

        // Tables to export as CSV (business data only)
        $exportTables = [
            'products', 'varieties', 'customers', 'suppliers',
            'procurements', 'processings', 'drying_processes',
            'stock_logs', 'orders', 'order_items', 
            'users',
        ];

        $availableTables = $this->getTables();
        $exportTables = array_filter($exportTables, fn($t) => in_array($t, $availableTables));

        $zipFilename = "{$safeName}_{$dateStr}_csv_export.zip";
        $tempPath = storage_path("app/{$zipFilename}");

        $zip = new \ZipArchive();
        if ($zip->open($tempPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            return response()->json(['message' => 'Could not create ZIP file'], 500);
        }

        foreach ($exportTables as $table) {
            $firstRow = DB::table($table)->first();
            if (!$firstRow) continue;

            $csv = fopen('php://temp', 'r+');
            // Header row
            $columns = array_keys((array) $firstRow);
            fputcsv($csv, $columns);
            // Data rows with chunking
            DB::table($table)->orderBy(DB::raw('1'))->chunk(500, function ($rows) use ($csv) {
                foreach ($rows as $row) {
                    fputcsv($csv, array_values((array) $row));
                }
            });
            rewind($csv);
            $csvContent = stream_get_contents($csv);
            fclose($csv);

            $zip->addFromString("{$table}.csv", $csvContent);
        }

        $zip->close();

        $this->logAudit('EXPORT', 'CSV', "Exported CSV data: {$zipFilename}", [
            'filename' => $zipFilename,
            'tables' => array_values($exportTables),
        ]);

        return response()->download($tempPath, $zipFilename, [
            'Content-Type' => 'application/zip',
        ])->deleteFileAfterSend(true);
    }

    /**
     * Import data from CSV file into a specific table
     */
    public function importCsv(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
            'table' => 'required|string',
        ]);

        $table = $request->input('table');
        $availableTables = $this->getTables();

        if (!in_array($table, $availableTables)) {
            return response()->json(['message' => 'Invalid table name'], 422);
        }

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        
        if (!$handle) {
            return response()->json(['message' => 'Could not read file'], 422);
        }

        $headers = fgetcsv($handle);
        if (!$headers) {
            fclose($handle);
            return response()->json(['message' => 'CSV file is empty or has no headers'], 422);
        }

        $imported = 0;
        $errors = 0;

        DB::beginTransaction();
        try {
            $batch = [];
            while (($row = fgetcsv($handle)) !== false) {
                if (count($row) !== count($headers)) {
                    $errors++;
                    continue;
                }
                $data = array_combine($headers, $row);
                $data = array_map(fn($v) => $v === 'NULL' || $v === '' ? null : $v, $data);
                $batch[] = $data;
                
                if (count($batch) >= 500) {
                    try {
                        DB::table($table)->insert($batch);
                        $imported += count($batch);
                    } catch (\Exception $e) {
                        // Fall back to row-by-row for this batch
                        foreach ($batch as $single) {
                            try {
                                DB::table($table)->insert($single);
                                $imported++;
                            } catch (\Exception $e2) {
                                $errors++;
                            }
                        }
                    }
                    $batch = [];
                }
            }
            // Insert remaining rows
            if (!empty($batch)) {
                try {
                    DB::table($table)->insert($batch);
                    $imported += count($batch);
                } catch (\Exception $e) {
                    foreach ($batch as $single) {
                        try {
                            DB::table($table)->insert($single);
                            $imported++;
                        } catch (\Exception $e2) {
                            $errors++;
                        }
                    }
                }
            }
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            fclose($handle);
            return response()->json(['message' => 'Import failed: ' . $e->getMessage()], 500);
        }

        fclose($handle);

        $this->logAudit('IMPORT', 'CSV', "Imported CSV data into {$table}: {$imported} rows", [
            'table' => $table,
            'imported' => $imported,
            'errors' => $errors,
        ]);

        return response()->json([
            'message' => "Imported {$imported} rows into {$table}" . ($errors > 0 ? " ({$errors} rows skipped)" : ''),
            'imported' => $imported,
            'errors' => $errors,
        ]);
    }
}
