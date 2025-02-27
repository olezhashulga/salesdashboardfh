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
    ['Ольга Ф.', '€30000,00', 'Смета'],
    ['Ольга Ф.', '€300,00', 'Смета'],
    ['Планди Б.', '€300,00', 'Смета'],
    ['Планди Б.', '€300,00', 'Смета'],
    ['Планди Б.', '€300,00', 'Смета'],
    ['Татьяна', '€15583,00', 'Смета'],
    ['Валерия', '€300,00', 'Смета'],
    ['Лина', '€17880,00', 'Заказ'],
    ['Ольга Ф.', '€35400,00', 'Заказ'],
    ['Лина', '€9300,00', 'Заказ'],
    ['Филипп', '€8500,00', 'Заказ'],
    ['Филипп', '€7200,00', 'Заказ'],
    ['Планди Б.', '€300,00', 'Смета'],
    ['Наталья', '€4500,00', 'Заказ'],
    ['Дария Б.', '€300,00', 'Доплата'],
    ['Ольга Ф.', '€200,00', 'Доплата']
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
  const summaryContainerRef = useRef<HTMLDivElement>(null);

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
      console.log("Trying to fetch sheet data...");
      
      // Прямой запрос к Google Sheets API
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
        }
      );

      console.log("API Response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Fetched data from Google Sheets:", data);
      
      // Проверка на наличие values в ответе
      if (!data.values || !Array.isArray(data.values) || data.values.length === 0) {
        console.warn("No data received from Google Sheets, using mock data");
        return getMockData();
      }
      
      return data.values;
    } catch (error) {
      console.error('Error fetching sheet data:', error);
      
      // В случае ошибки возвращаем тестовые данные
      console.log("Returning mock data due to error");
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

  // Функция для обработки сырых данных из таблицы
  const processSheetData = (rawData: Array<Array<string>>): {
    transactions: Transaction[];
    champions: ChampionData;
    summary: ManagerSummary[];
    total: number;
  } => {
    console.log("Raw sheet data:", rawData); // Отладочный вывод

    // Преобразование сырых данных таблицы в объекты транзакций
    const transactions = rawData.map(row => {
      // Проверяем наличие всех нужных данных в строке
      if (!row || row.length < 3) {
        console.log("Invalid row data:", row);
        return {
          name: '',
          amount: 0,
          type: ''
        };
      }
      
      // Корректно обрабатываем сумму, удаляя все кроме цифр, точек и запятых
      let amountStr = row[1] || '0';
      
      // Если сумма в формате "€300,00", извлекаем только числовую часть
      if (amountStr.startsWith('€')) {
        amountStr = amountStr.substring(1);
      }
      
      // Заменяем европейский формат (запятая - разделитель) на американский (точка)
      amountStr = amountStr.replace(/\s+/g, '').replace(',', '.');
      
      // Если есть другие нецифровые символы кроме точки, удаляем их
      amountStr = amountStr.replace(/[^0-9.]/g, '');
      
      // Преобразуем в число
      const amount = parseFloat(amountStr) || 0;
      
      return {
        name: row[0] || '',
        amount: amount,
        type: row[2] || ''
      };
    });

    // Фильтруем невалидные транзакции, включая статус "Доплата"
    const validTransactions = transactions.filter(t => t.name && (t.type === 'Смета' || t.type === 'Заказ' || t.type === 'Доплата'));

    console.log("Parsed transactions:", validTransactions); // Отладочный вывод

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
    validTransactions.forEach(t => {
      if (!t.name) return;

      // Подсчёт смет
      if (t.type === 'Смета') {
        estimateCount.set(t.name, (estimateCount.get(t.name) || 0) + 1);
      }
      // Подсчёт заказов
      if (t.type === 'Заказ') {
        orderCount.set(t.name, (orderCount.get(t.name) || 0) + 1);
      }
      
      // Отслеживание всех сумм по менеджеру, включая доплаты
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
        // Учитываем все суммы, включая доплаты
        summary.totalAmount += t.amount;
      }
    });

    // Логируем данные по каждому менеджеру для отладки
    console.log("Manager summary data:");
    managerSummary.forEach((data, name) => {
      console.log(`${name}: ${data.totalAmount}€ (${data.estimates} смет, ${data.orders} заказов)`);
    });

    // Поиск самой высокой суммы для каждого менеджера
    const highestAmountMap = new Map<string, number>();
    amountByManager.forEach((amounts, manager) => {
      if (amounts.length > 0) {
        highestAmountMap.set(manager, Math.max(...amounts));
      } else {
        highestAmountMap.set(manager, 0);
      }
    });

    // Определение чемпионов
    const estimatesChampion = getMaxEntry(estimateCount);
    const highestAmountEntry = getMaxEntry(highestAmountMap);
    const ordersChampion = getMaxEntry(orderCount);

    const newChampions = {
      mostEstimates: estimatesChampion,
      highestAmount: { name: highestAmountEntry.name, amount: highestAmountEntry.count },
      mostOrders: ordersChampion
    };

    console.log("Champions:", newChampions); // Отладочный вывод

    // Вычисляем общую сумму (включая доплаты)
    const totalAmount = validTransactions.reduce((sum, t) => sum + t.amount, 0);
    console.log("Total amount:", totalAmount); // Отладочный вывод

    return {
      transactions: validTransactions,
      champions: newChampions,
      summary: Array.from(managerSummary.values()),
      total: totalAmount
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

      <div style={{ display: 'flex', height: 'calc(100vh - 32px)' }}>
        {/* Левая колонка - список транзакций, вытянутый до нижней границы */}
        <div style={{ 
          width: '33%', 
          overflowY: 'auto',
          paddingRight: '16px',
          height: '100%', // Растягиваем на всю высоту
          display: 'flex',
          flexDirection: 'column'
        }}>
          {transactions.map((t, i) => (
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

        {/* Правая колонка - информация о чемпионах и сводная таблица */}
        <div style={{ 
          width: '67%', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center'
        }}>
          {/* Заголовок чемпионов */}
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

          {/* Таблица чемпионов */}
          <div style={{ display: 'flex', width: '100%', justifyContent: 'center', marginBottom: '30px' }}>
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

          {/* Сводная таблица */}
          <div ref={summaryContainerRef} style={{ width: '500px' }}>
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
