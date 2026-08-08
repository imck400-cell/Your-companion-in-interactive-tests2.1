<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class BackupDatabase extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'db:backup';
    protected $description = 'Backup the MySQL database and keep only the last 7 days of backups.';

    public function handle()
    {
        $database = env('DB_DATABASE');
        $username = env('DB_USERNAME');
        $password = env('DB_PASSWORD');
        $host = env('DB_HOST', '127.0.0.1');
        
        $backupPath = storage_path('app/backups');
        
        if (!\File::exists($backupPath)) {
            \File::makeDirectory($backupPath, 0755, true);
        }

        $filename = 'backup_' . date('Y_m_d_H_i_s') . '.sql.gz';
        $filePath = $backupPath . '/' . $filename;

        // Command to run mysqldump and gzip the output
        $passwordString = $password ? "-p\"{$password}\"" : "";
        $command = "mysqldump -h {$host} -u {$username} {$passwordString} {$database} | gzip > {$filePath}";
        
        $returnVar = null;
        $output = null;
        exec($command, $output, $returnVar);

        if ($returnVar === 0) {
            $this->info("Database backup created successfully: {$filename}");
            $this->cleanOldBackups($backupPath);
        } else {
            $this->error("Database backup failed.");
        }
    }

    private function cleanOldBackups($backupPath)
    {
        $files = \File::files($backupPath);
        $now = now();
        
        $deletedCount = 0;
        foreach ($files as $file) {
            // Check if file is older than 7 days
            if ($now->diffInDays(\Carbon\Carbon::createFromTimestamp($file->getMTime())) > 7) {
                \File::delete($file);
                $deletedCount++;
            }
        }
        
        if ($deletedCount > 0) {
            $this->info("Cleaned up {$deletedCount} old backup(s).");
        }
    }
}
