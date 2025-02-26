import React, { useState, useEffect, useRef } from 'react';
import { Trophy } from 'lucide-react';

// Google Sheets API настройки
const SHEET_ID = '1DH_2A_2Bn7UBSiUOYzq7yMNr_uut1Gc6cQFbsx9EOf8';
const API_KEY = 'AIzaSyD8zF5IwxeH6-nb8WU6T9x_7HYNGE1B5fA';
const RANGE = 'A2:C1000';

// Целевая сумма для прогресс-бара
const TARGET_AMOUNT = 600000;

// Интерфейсы для TypeScript
interface Transaction {
  name: string;
  amount: number;
  type: string;
}

interface ChampionData {
  mostEstimates: { name: string; count: number };
  highestAmount: { name: string; amount: number };
  mostOrders: { name: string; count: number };
}

interface ManagerSummary {
  manager: string;
  estimates: number;
  totalAmount: number;
  orders: number;
}

// Тестовые данные для запасного варианта, если API недоступен
const getMockData = (): Array<Array<string>> => {
  return [
    ['Ольга Ф.', '30000', 'Смета'],
    ['Ольга Ф.', '300', 'Смета'],
    ['Планди Б.', '300', 'Смета'],
    ['Планди Б.', '300', 'Смета'],
    ['Планди Б.', '300', 'Смета'],
    ['Татьяна', '15583', 'Смета'],
    ['Валерия', '300', 'Смета'],
    ['Лина', '17880', 'Заказ'],
    ['Ольга Ф.', '35400', 'Заказ'],
    ['Лина', '9300', 'Заказ'],
    ['Филипп', '8500', 'Заказ'],
    ['Филипп', '7200', 'Заказ'],
    ['Планди Б.', '300', 'Смета'],
    ['Наталья', '4500', 'Заказ']
  ];
};

const SalesDashboard: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [champions, setChampions] = useState<ChampionData>({
    mostEstimates: { name: '', count: 0 },
    highestAmount: { name: '', amount: 0 },
    mostOrders: { name: '', count: 0 }
  });
  const [summaryData, setSummaryData] = useState<ManagerSummary[]>([]);
  const [notification, setNotification] = useState<Transaction | null>(null);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTransactionCountRef = useRef<number>(0);

  // Безопасная функция форматирования с правильным типом для параметра
  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null) return "0";
    try {
      return num.toLocaleString() || "0";
    } catch (e) {
      console.error("Error formatting number:", e);
      return "0";
    }
  };

  // Функция для воспроизведения звука
  const playFanfare = (): void => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log("Ошибка воспроизведения звука:", e));
    }
  };

  // Функция для получения данных из Google Sheets
  const fetchSheetData = async (): Promise<Array<Array<string>>> => {
    try {
      // Активное подключение к Google Sheets API
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`
      );

      if (!response.ok) {
        console.error('Google Sheets API Error:', response.status);
        throw new Error('Failed to fetch data');
      }

      const data = await response.json();
      return data.values || [];
    } catch (error) {
      console.error('Error fetching sheet data:', error);
      // В случае ошибки возвращаем тестовые данные
      return getMockData();
    }
  };

  const getMaxEntry = (map: Map<string, number>): { name: string; count: number } => {
    let maxName = '';
    let maxCount = 0;
    map.forEach((count, name) => {
      if (count > maxCount) {
        maxCount = count;
        maxName = name;
      }
    });
    return { name: maxName, count: maxCount };
  };

  const processSheetData = (rawData: Array<Array<string>>): {
    transactions: Transaction[];
    champions: ChampionData;
    summary: ManagerSummary[];
    total: number;
  } => {
    // Преобразование сырых данных таблицы в объекты транзакций
    const transactions = rawData.map(row => ({
      name: row[0] || '',
      amount: parseFloat(String(row[1] || '0').replace(/\s+/g, '').replace(',', '.')) || 0,
      type: row[2] || ''
    }));

    console.log("Parsed transactions:", transactions);

    // Расчёт данных для чемпионов и сводной таблицы
    const estimateCount = new Map<string, number>();
    const amountByManager = new Map<string, number[]>();
    const orderCount = new Map<string, number>();
    const managerSummary = new Map<string, ManagerSummary>();

    // Инициализация всех менеджеров
    const managerNames = [
      'Ольга Ф.', 'Планди Б.', 'Дария Б.', 'Файсал Б.', 
      'Валерия', 'Наталья', 'Филипп', 'Лина', 
      'Елена С.', 'Кристиан С.', 'Елена Ш.', 'Роман', 'Татьяна'
    ];
    
    managerNames.forEach(name => {
      managerSummary.set(name, {
        manager: name,
        estimates: 0,
        totalAmount: 0,
        orders: 0
      });
    });

    // Обработка каждой транзакции
    transactions.forEach(t => {
      if (!t.name) return;

      // Подсчёт смет
      if (t.type === 'Смета') {
        estimateCount.set(t.name, (estimateCount.get(t.name) || 0) + 1);
      }
      // Подсчёт заказов
      if (t.type === 'Заказ') {
        orderCount.set(t.name, (orderCount.get(t.name) || 0) + 1);
      }
      
      // Отслеживание всех сумм по менеджеру
      if (!amountByManager.has(t.name)) {
        amountByManager.set(t.name, []);
      }
      const amounts = amountByManager.get(t.name);
      if (amounts) {
        amounts.push(t.amount);
      }

      // Обновление сводки по менеджеру
      if (!managerSummary.has(t.name)) {
        managerSummary.set(t.name, {
          manager: t.name,
          estimates: 0,
          totalAmount: 0,
          orders: 0
        });
      }
      
      const summary = managerSummary.get(t.name);
      if (summary) {
        if (t.type === 'Смета') summary.estimates++;
        if (t.type === 'Заказ') summary.orders++;
        summary.totalAmount += t.amount;
      }
    });

    // Поиск самой высокой суммы для каждого менеджера
    const highestAmountMap = new Map<string, number>();
    amountByManager.forEach((amounts, manager) => {
      highestAmountMap.set(manager, Math.max(...amounts, 0));
    });

    // Определение чемпионов
    const highestAmountEntry = getMaxEntry(highestAmountMap);
    const newChampions = {
      mostEstimates: getMaxEntry(estimateCount),
      highestAmount: { name: highestAmountEntry.name, amount: highestAmountEntry.count },
      mostOrders: getMaxEntry(orderCount)
    };

    return {
      transactions,
      champions: newChampions,
      summary: Array.from(managerSummary.values()),
      total: transactions.reduce((sum, t) => sum + t.amount, 0)
    };
  };

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      const rawData = await fetchSheetData();
      if (rawData && rawData.length > 0) {
        const processedData = processSheetData(rawData);
        
        // Проверяем, появились ли новые транзакции
        if (processedData.transactions.length > lastTransactionCountRef.current) {
          // Получаем последнюю транзакцию
          const latest = processedData.transactions[processedData.transactions.length - 1];
          setNotification(latest);
          
          // Воспроизводим звук фанфар
          playFanfare();
          
          // Скрываем уведомление через 4 секунды
          setTimeout(() => setNotification(null), 4000);
          
          // Обновляем счетчик транзакций
          lastTransactionCountRef.current = processedData.transactions.length;
        }

        setTransactions(processedData.transactions);
        setChampions(processedData.champions);
        setSummaryData(processedData.summary);
        setTotalAmount(processedData.total);
      }
    };

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh',
      backgroundColor: 'black', 
      color: 'white', 
      padding: '16px', 
      position: 'relative' 
    }}>
      {/* Аудио-элемент для воспроизведения фанфар */}
      <audio 
        ref={audioRef} 
        src="/torjestvennyie-fanfaryi-24685.mp3" 
        preload="auto"
      />

      {/* Уведомление о новой транзакции */}
      {notification && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.9)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '4.5rem', fontWeight: 'bold', marginBottom: '16px' }}>
              {formatNumber(notification.amount)} €
            </div>
            <div style={{ fontSize: '2.25rem' }}>{notification.name}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Верхняя секция */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
          {/* Список транзакций - в виде таблицы с фиксированными колонками */}
          <div style={{ width: '33%' }}>
            {transactions.slice(-10).map((t, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                color: '#fb923c', 
                marginBottom: '5px', 
                fontSize: '16px'
              }}>
                <div style={{ width: '110px' }}>{t.name}</div>
                <div style={{ width: '90px', textAlign: 'right' }}>{formatNumber(t.amount)} €</div>
              </div>
            ))}
          </div>

          {/* Блок с чемпионами */}
          <div style={{ width: '67%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '20px', 
              color: '#fb923c', 
              fontSize: '24px' 
            }}>
              <Trophy style={{ width: '24px', height: '24px', color: '#eab308', marginRight: '8px' }} />
              ЧЕМПИОНЫ МЕСЯЦА
              <Trophy style={{ width: '24px', height: '24px', color: '#eab308', marginLeft: '8px' }} />
            </div>

            <div style={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
              <div style={{ width: '350px' }}>
                <div style={{ 
                  display: 'flex', 
                  marginBottom: '5px',
                  alignItems: 'center'
                }}>
                  <div style={{ width: '180px' }}>Больше всего смет:</div>
                  <div style={{ width: '100px', color: '#fb923c', textAlign: 'center' }}>{champions.mostEstimates.name}</div>
                  <div style={{ width: '70px', color: '#fb923c', textAlign: 'right' }}>{champions.mostEstimates.count}</div>
                </div>
                <div style={{ 
                  display: 'flex', 
                  marginBottom: '5px',
                  alignItems: 'center'
                }}>
                  <div style={{ width: '180px' }}>Самый высокий чек:</div>
                  <div style={{ width: '100px', color: '#fb923c', textAlign: 'center' }}>{champions.highestAmount.name}</div>
                  <div style={{ width: '70px', color: '#fb923c', textAlign: 'right' }}>{formatNumber(champions.highestAmount.amount)} €</div>
                </div>
                <div style={{ 
                  display: 'flex', 
                  marginBottom: '5px',
                  alignItems: 'center'
                }}>
                  <div style={{ width: '180px' }}>Больше всего заказов:</div>
                  <div style={{ width: '100px', color: '#fb923c', textAlign: 'center' }}>{champions.mostOrders.name}</div>
                  <div style={{ width: '70px', color: '#fb923c', textAlign: 'right' }}>{champions.mostOrders.count}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Сводная таблица - центрирована */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
          <div style={{ width: '500px' }}>
            <div style={{ display: 'flex', marginBottom: '8px' }}>
              <div style={{ width: '170px', color: '#fb923c', fontWeight: 'bold' }}>Менеджер</div>
              <div style={{ width: '100px', color: '#fb923c', fontWeight: 'bold', textAlign: 'center' }}>Смет</div>
              <div style={{ width: '130px', color: '#fb923c', fontWeight: 'bold', textAlign: 'center' }}>Сумма</div>
              <div style={{ width: '100px', color: '#fb923c', fontWeight: 'bold', textAlign: 'center' }}>Заказов</div>
            </div>

            {summaryData.map((manager, i) => (
              <div key={i} style={{ display: 'flex', marginBottom: '3px' }}>
                <div style={{ width: '170px', color: '#fb923c' }}>{manager.manager}</div>
                <div style={{ width: '100px', color: '#fb923c', textAlign: 'center' }}>{manager.estimates}</div>
                <div style={{ width: '130px', color: '#fb923c', textAlign: 'center' }}>{formatNumber(manager.totalAmount)} €</div>
                <div style={{ width: '100px', color: '#fb923c', textAlign: 'center' }}>{manager.orders}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Прогресс-бар с максимальным значением 600 000 € */}
      <div style={{
        position: 'fixed',
        right: '32px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '32px',
        height: '384px'
      }}>
        <div style={{ 
          position: 'relative',
          height: '100%',
          width: '100%',
          backgroundColor: '#374151',
          borderRadius: '9999px',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            height: `${Math.min((totalAmount / TARGET_AMOUNT) * 100, 100)}%`,
            background: 'linear-gradient(to top, #22c55e, #f97316)',
            borderRadius: '9999px',
            transition: 'height 1s'
          }} />
        </div>
        <div style={{
          position: 'absolute',
          top: '100%',
          marginTop: '16px',
          color: 'white',
          fontSize: '1.125rem',
          transformOrigin: 'left',
          transform: 'rotate(-90deg)',
          whiteSpace: 'nowrap'
        }}>
          {formatNumber(totalAmount)} €
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
