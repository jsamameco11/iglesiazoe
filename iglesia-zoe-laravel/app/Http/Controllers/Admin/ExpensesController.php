<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Finance\Finance;
use App\Domain\Media\Support\MediaLibrary;
use App\Http\Controllers\Controller;
use App\Models\Expense;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExpensesController extends Controller
{
    public const CATEGORIES = ['Limpieza', 'Alimentos y refrigerios', 'Decoración', 'Sonido y multimedia', 'Mantenimiento', 'Útiles y materiales', 'Servicios', 'Eventos', 'Otros'];

    public function index(Request $request): Response
    {
        $user = $request->user();
        $month = preg_match('/^\d{4}-\d{2}$/', (string) $request->query('mes')) ? (string) $request->query('mes') : now()->format('Y-m');
        $from = Carbon::parse($month.'-01')->startOfMonth();
        $to = $from->copy()->endOfMonth();
        $rows = Expense::query()->with('user')
            ->whereBetween('spent_on', [$from->toDateString(), $to->toDateString()])
            ->when(! $user->isSuperadmin(), fn ($query) => $query->where('user_id', $user->id))
            ->orderByDesc('spent_on')->orderByDesc('created_at')
            ->get();

        return Inertia::render('Admin/Gastos', [
            'month' => $month,
            'categories' => self::CATEGORIES,
            'all' => $user->isSuperadmin(),
            'total' => Finance::money((float) $rows->sum('amount')),
            'rows' => $rows->map(fn (Expense $expense) => $this->row($expense)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'spent_on' => 'required|date|before_or_equal:today',
            'category' => 'required|string|max:60',
            'detail' => 'required|string|min:3|max:1000',
            'amount' => 'required|numeric|min:0.1|max:999999',
            'receipt' => 'required|file|mimes:jpg,jpeg,png,webp,heic,pdf|max:12288',
        ], [
            'receipt.required' => 'Sube la foto de la boleta o factura.',
            'receipt.mimes' => 'La boleta o factura debe ser una imagen o un PDF.',
            'receipt.max' => 'La boleta o factura no puede pesar más de 12 MB.',
            'detail.required' => 'Escribe el detalle de lo que se compró.',
            'amount.required' => 'Escribe el monto.',
            'spent_on.before_or_equal' => 'La fecha no puede ser futura.',
        ]);
        $receipt = $request->file('receipt');
        $path = MediaLibrary::storePrivate($receipt, 'gastos/'.now()->format('Y/m'), $receipt->guessExtension() ?: $receipt->extension());
        Expense::query()->create([
            'user_id' => $request->user()->id,
            'spent_on' => $request->input('spent_on'),
            'category' => in_array($request->input('category'), self::CATEGORIES, true) ? $request->input('category') : 'Otros',
            'detail' => trim((string) $request->input('detail')),
            'amount' => round((float) $request->input('amount'), 2),
            'receipt_path' => $path,
        ]);

        return $this->saved('Gasto registrado.');
    }

    public function destroy(Request $request): JsonResponse
    {
        $id = (string) $request->input('id');
        $expense = $this->find(Expense::class, $id);
        if (! $expense || (! $request->user()->isSuperadmin() && $expense->user_id !== $request->user()->id)) {
            return $this->fail('No puedes eliminar este gasto.', 403);
        }
        MediaLibrary::deletePrivate($expense->receipt_path);
        $expense->delete();

        return $this->saved('Gasto eliminado.');
    }

    public function receipt(Request $request, string $id): RedirectResponse|StreamedResponse
    {
        $expense = Expense::query()->findOrFail($id);
        abort_unless($request->user()->isSuperadmin() || $expense->user_id === $request->user()->id, 403);
        abort_unless((bool) $expense->receipt_path, 404);

        $url = MediaLibrary::cloud() ? MediaLibrary::privateUrl($expense->receipt_path, 10) : null;

        return $url ? redirect()->away($url) : MediaLibrary::privateDisk()->response($expense->receipt_path);
    }

    public static function row(Expense $expense): array
    {
        return [
            'id' => $expense->id,
            'spent_on' => $expense->spent_on->toDateString(),
            'category' => $expense->category,
            'detail' => $expense->detail,
            'amount' => (float) $expense->amount,
            'by' => $expense->user?->name ?? 'Cuenta eliminada',
            'receipt' => $expense->receipt_path ? '/admin/gastos/boleta/'.$expense->id : null,
            'is_pdf' => str_ends_with(strtolower((string) $expense->receipt_path), '.pdf'),
        ];
    }
}
