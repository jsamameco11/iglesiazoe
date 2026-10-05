<?php

namespace App\Models;

use App\Domain\Shared\Models\UuidModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends UuidModel
{
    protected $fillable = ['user_id', 'spent_on', 'category', 'detail', 'amount', 'receipt_path'];

    protected function casts(): array
    {
        return [
            'spent_on' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * One line of the Gastos and Finanzas tables; load the user relation first.
     *
     * @return array{id: string, spent_on: string, category: string, detail: ?string, amount: float, by: string, receipt: ?string, is_pdf: bool}
     */
    public function row(): array
    {
        return [
            'id' => $this->id,
            'spent_on' => $this->spent_on->toDateString(),
            'category' => $this->category,
            'detail' => $this->detail,
            'amount' => (float) $this->amount,
            'by' => $this->user?->name ?? 'Cuenta eliminada',
            'receipt' => $this->receipt_path ? '/admin/gastos/boleta/'.$this->id : null,
            'is_pdf' => str_ends_with(strtolower((string) $this->receipt_path), '.pdf'),
        ];
    }
}
