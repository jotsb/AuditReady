interface CategoryData {
  name: string;
  amount: number;
  color: string;
}

interface CategoryChartProps {
  data: CategoryData[];
}

export function CategoryChart({ data }: CategoryChartProps) {
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  const maxAmount = Math.max(...data.map((item) => item.amount));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-6">Expenses by Category</h3>

      <div className="space-y-4">
        {data.map((category, index) => {
          const percentage = total > 0 ? (category.amount / total) * 100 : 0;
          const barWidth = maxAmount > 0 ? (category.amount / maxAmount) * 100 : 0;

          return (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{category.name}</span>
                <span className="text-slate-600">
                  ${category.amount.toFixed(2)} ({percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: category.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {data.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          No expense data available
        </div>
      )}
    </div>
  );
}
