<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CleanupGuestAccounts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:cleanup-guest-accounts';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Cleanup guest_teacher accounts older than 45 days';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $cutoffDate = now()->subDays(45);
        
        $guestsToDelete = \App\Models\User::where('role', 'guest_teacher')
            ->where('created_at', '<', $cutoffDate)
            ->get();

        $count = $guestsToDelete->count();

        if ($count > 0) {
            foreach ($guestsToDelete as $guest) {
                $guest->delete();
            }
            $this->info("Successfully deleted {$count} guest accounts older than 45 days.");
        } else {
            $this->info('No old guest accounts found to delete.');
        }
    }
}
