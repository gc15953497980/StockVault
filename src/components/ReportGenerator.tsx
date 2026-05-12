import { useStockStore } from '../store/useStockStore';
import { useFundStore } from '../store/useFundStore';
import { generateReportHTML, downloadReport } from '../utils/report';

export default function ReportGenerator() {
  const stocks = useStockStore(s => s.stocks);
  const prices = useStockStore(s => s.prices);
  const funds = useFundStore(s => s.funds);
  const navs = useFundStore(s => s.navs);
  const handleGenerate = () => {
    const html = generateReportHTML({
      stocks,
      funds,
      stockPrices: prices,
      fundNavs: navs,
    });
    downloadReport(html);
  };

  const hasData = stocks.length + funds.length > 0;

  return (
    <button
      onClick={handleGenerate}
      disabled={!hasData}
      style={{
        padding: '7px 14px',
        background: hasData ? 'var(--primary)' : 'var(--btn-default-bg)',
        color: hasData ? '#fff' : 'var(--btn-default-text)',
        border: '1px solid var(--border-heavy)',
        borderRadius: 6,
        cursor: hasData ? 'pointer' : 'not-allowed',
        fontSize: 13,
      }}
    >
      导出报告
    </button>
  );
}
