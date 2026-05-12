import { useState } from 'react';
import { useTxStore } from '../store/useTxStore';

// --- Stock Transaction Panel ---
export function StockTxPanel({ stockId }: { stockId: string }) {
  const txs = useTxStore((s) => s.stockTxs[stockId] || []);
  const addStockTx = useTxStore((s) => s.addStockTx);
  const deleteStockTx = useTxStore((s) => s.deleteStockTx);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState('');
  const [shares, setShares] = useState('');

  const handleAdd = () => {
    const p = parseFloat(price);
    const s = parseInt(shares, 10);
    if (!p || !s || p <= 0 || s <= 0) return;
    addStockTx(stockId, { id: Date.now().toString(36), date, type, price: p, shares: s });
    setPrice(''); setShares(''); setShowForm(false);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>交易记录</span>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle}>
          {showForm ? '取消' : '+ 添加'}
        </button>
      </div>
      {showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          <select value={type} onChange={(e) => setType(e.target.value as 'buy' | 'sell')} style={inputStyle}>
            <option value="buy">买入</option>
            <option value="sell">卖出</option>
          </select>
          <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="价格" style={{ ...inputStyle, width: 80 }} />
          <input type="number" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="股数" style={{ ...inputStyle, width: 80 }} />
          <button onClick={handleAdd} style={btnPrimaryStyle}>保存</button>
        </div>
      )}
      {txs.length > 0 && (
        <div style={{ maxHeight: 120, overflowY: 'auto' }}>
          {txs.map((tx) => (
            <div key={tx.id} style={{ display: 'flex', gap: 12, fontSize: 12, padding: '2px 0', color: 'var(--text-secondary)' }}>
              <span>{tx.date}</span>
              <span style={{ color: tx.type === 'buy' ? 'var(--up)' : 'var(--down)' }}>{tx.type === 'buy' ? '买入' : '卖出'}</span>
              <span>{tx.price.toFixed(2)}</span>
              <span>{tx.shares}股</span>
              <span style={{ color: 'var(--text)' }}>{(tx.price * tx.shares).toFixed(2)}</span>
              <button onClick={() => deleteStockTx(stockId, tx.id)} style={delBtnStyle}>删</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Stock Dividend Panel ---
export function StockDividendPanel({ stockId }: { stockId: string }) {
  const divs = useTxStore((s) => s.stockDividends[stockId] || []);
  const addStockDividend = useTxStore((s) => s.addStockDividend);
  const deleteStockDividend = useTxStore((s) => s.deleteStockDividend);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');

  const handleAdd = () => {
    const a = parseFloat(amount);
    if (!a || a <= 0) return;
    addStockDividend(stockId, { id: Date.now().toString(36), date, amount: a });
    setAmount(''); setShowForm(false);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>分红记录</span>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle}>{showForm ? '取消' : '+ 添加'}</button>
      </div>
      {showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="金额" style={{ ...inputStyle, width: 100 }} />
          <button onClick={handleAdd} style={btnPrimaryStyle}>保存</button>
        </div>
      )}
      {divs.length > 0 && (
        <div style={{ maxHeight: 120, overflowY: 'auto' }}>
          {divs.map((d) => (
            <div key={d.id} style={{ display: 'flex', gap: 12, fontSize: 12, padding: '2px 0', color: 'var(--text-secondary)' }}>
              <span>{d.date}</span>
              <span style={{ color: 'var(--up)' }}>+{d.amount.toFixed(2)}</span>
              <button onClick={() => deleteStockDividend(stockId, d.id)} style={delBtnStyle}>删</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Fund Transaction Panel ---
export function FundTxPanel({ fundId }: { fundId: string }) {
  const txs = useTxStore((s) => s.fundTxs[fundId] || []);
  const addFundTx = useTxStore((s) => s.addFundTx);
  const deleteFundTx = useTxStore((s) => s.deleteFundTx);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [nav, setNav] = useState('');
  const [amount, setAmount] = useState('');

  const handleAdd = () => {
    const n = parseFloat(nav);
    const a = parseFloat(amount);
    if (!n || !a || n <= 0 || a <= 0) return;
    addFundTx(fundId, { id: Date.now().toString(36), date, type, nav: n, amount: a });
    setNav(''); setAmount(''); setShowForm(false);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>交易记录</span>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle}>{showForm ? '取消' : '+ 添加'}</button>
      </div>
      {showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          <select value={type} onChange={(e) => setType(e.target.value as 'buy' | 'sell')} style={inputStyle}>
            <option value="buy">申购</option>
            <option value="sell">赎回</option>
          </select>
          <input type="number" step="0.0001" value={nav} onChange={(e) => setNav(e.target.value)} placeholder="净值" style={{ ...inputStyle, width: 90 }} />
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="金额" style={{ ...inputStyle, width: 90 }} />
          <button onClick={handleAdd} style={btnPrimaryStyle}>保存</button>
        </div>
      )}
      {txs.length > 0 && (
        <div style={{ maxHeight: 120, overflowY: 'auto' }}>
          {txs.map((tx) => (
            <div key={tx.id} style={{ display: 'flex', gap: 12, fontSize: 12, padding: '2px 0', color: 'var(--text-secondary)' }}>
              <span>{tx.date}</span>
              <span style={{ color: tx.type === 'buy' ? 'var(--up)' : 'var(--down)' }}>{tx.type === 'buy' ? '申购' : '赎回'}</span>
              <span>净值{tx.nav.toFixed(4)}</span>
              <span style={{ color: 'var(--text)' }}>{tx.amount.toFixed(2)}</span>
              <button onClick={() => deleteFundTx(fundId, tx.id)} style={delBtnStyle}>删</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Fund Dividend Panel ---
export function FundDividendPanel({ fundId }: { fundId: string }) {
  const divs = useTxStore((s) => s.fundDividends[fundId] || []);
  const addFundDividend = useTxStore((s) => s.addFundDividend);
  const deleteFundDividend = useTxStore((s) => s.deleteFundDividend);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dtype, setDType] = useState<'cash' | 'reinvest'>('cash');
  const [amount, setAmount] = useState('');

  const handleAdd = () => {
    const a = parseFloat(amount);
    if (!a || a <= 0) return;
    addFundDividend(fundId, { id: Date.now().toString(36), date, type: dtype, amount: a });
    setAmount(''); setShowForm(false);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>分红记录</span>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle}>{showForm ? '取消' : '+ 添加'}</button>
      </div>
      {showForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          <select value={dtype} onChange={(e) => setDType(e.target.value as 'cash' | 'reinvest')} style={inputStyle}>
            <option value="cash">现金分红</option>
            <option value="reinvest">红利再投</option>
          </select>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="金额" style={{ ...inputStyle, width: 100 }} />
          <button onClick={handleAdd} style={btnPrimaryStyle}>保存</button>
        </div>
      )}
      {divs.length > 0 && (
        <div style={{ maxHeight: 120, overflowY: 'auto' }}>
          {divs.map((d) => (
            <div key={d.id} style={{ display: 'flex', gap: 12, fontSize: 12, padding: '2px 0', color: 'var(--text-secondary)' }}>
              <span>{d.date}</span>
              <span style={{ color: 'var(--text)' }}>{d.type === 'cash' ? '现金分红' : '红利再投'}</span>
              <span style={{ color: 'var(--up)' }}>+{d.amount.toFixed(2)}</span>
              <button onClick={() => deleteFundDividend(fundId, d.id)} style={delBtnStyle}>删</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid var(--border-heavy)', borderRadius: 4,
  fontSize: 12, background: 'var(--surface)', color: 'var(--text)',
};

const btnStyle: React.CSSProperties = {
  border: '1px dashed var(--primary)', background: 'none', color: 'var(--primary)',
  padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
};

const btnPrimaryStyle: React.CSSProperties = {
  border: 'none', background: 'var(--primary)', color: '#fff',
  padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
};

const delBtnStyle: React.CSSProperties = {
  border: 'none', background: 'none', color: 'var(--up)', cursor: 'pointer',
  fontSize: 10, padding: '0 2px',
};
