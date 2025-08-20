# Frontend API Guide สำหรับ Periods

## ✅ Backend เสร็จแล้ว

### 1. API Endpoints ที่พร้อมใช้งาน:

#### GET `/api/contracts/:id/periods`
ดึงงวดงานของสัญญาเฉพาะ
```javascript
// Response Format:
[
  {
    "id": 1,
    "contract_id": 1,
    "period_no": 1,
    "status": "รอดำเนินการ", // หรือ "กำลังดำเนินการ", "เสร็จสิ้น", "รอส่งมอบ"
    "due_date": "2025-02-15T00:00:00.000Z",
    "description": "งวดที่ 1",
    "amount": 100000,
    "alert_days": 7,
    "created_at": "2025-01-15T10:30:00.000Z",
    "updated_at": "2025-01-15T10:30:00.000Z"
  }
  // ... periods อื่นๆ
]
```

#### GET `/api/periods`
ดึงงวดงานทั้งหมดในระบบ (fallback)
```javascript
// Response Format:
[
  {
    "id": 1,
    "contract_id": 1,
    "period_no": 1,
    "status": "รอดำเนินการ",
    "due_date": "2025-02-15T00:00:00.000Z",
    "description": "งวดที่ 1",
    "amount": 100000,
    "alert_days": 7,
    // ข้อมูลสัญญาเพิ่มเติม
    "contract_no": "CON-2025-001",
    "contact_name": "บริษัท ABC จำกัด",
    "department": "IT",
    "created_at": "2025-01-15T10:30:00.000Z",
    "updated_at": "2025-01-15T10:30:00.000Z"
  }
  // ... periods อื่นๆ
]
```

### 2. สถานะที่ Backend รองรับ:
- `"รอดำเนินการ"` - งวดที่ยังไม่เริ่มทำ (default)
- `"กำลังดำเนินการ"` - งวดที่กำลังทำอยู่
- `"เสร็จสิ้น"` - งวดที่เสร็จแล้ว
- `"รอส่งมอบ"` - งวดที่ทำเสร็จแต่ยังไม่ส่งมอบ

## 📋 สิ่งที่ Frontend ต้องทำ:

### 1. รัน Database Migration ก่อน:
```sql
-- รันไฟล์ update_periods_table.sql ในฐานข้อมูล
-- เพื่อเพิ่ม columns: description, amount, status, alert_days, created_at, updated_at
```

### 2. เรียกใช้ API:

#### ดึงงวดงานของสัญญาเฉพาะ:
```javascript
const fetchContractPeriods = async (contractId) => {
  try {
    const response = await fetch(`/api/contracts/${contractId}/periods`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const periods = await response.json();
      return periods;
    } else {
      throw new Error('Failed to fetch periods');
    }
  } catch (error) {
    console.error('Error fetching contract periods:', error);
    return [];
  }
};
```

#### ดึงงวดงานทั้งหมด:
```javascript
const fetchAllPeriods = async () => {
  try {
    const response = await fetch('/api/periods', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const periods = await response.json();
      return periods;
    } else {
      throw new Error('Failed to fetch all periods');
    }
  } catch (error) {
    console.error('Error fetching all periods:', error);
    return [];
  }
};
```

### 3. แสดงผลสถานะ:
```javascript
const getStatusColor = (status) => {
  switch (status) {
    case 'รอดำเนินการ':
      return 'bg-gray-100 text-gray-800';
    case 'กำลังดำเนินการ':
      return 'bg-blue-100 text-blue-800';
    case 'เสร็จสิ้น':
      return 'bg-green-100 text-green-800';
    case 'รอส่งมอบ':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const StatusBadge = ({ status }) => (
  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
    {status}
  </span>
);
```

### 4. แสดงผลจำนวนเงิน:
```javascript
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB'
  }).format(amount);
};
```

### 5. แสดงผลวันที่:
```javascript
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};
```

## 🚀 ตัวอย่างการใช้งาน:

```javascript
// Component สำหรับแสดงรายการงวดงาน
const PeriodsList = ({ contractId }) => {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPeriods = async () => {
      setLoading(true);
      const data = await fetchContractPeriods(contractId);
      setPeriods(data);
      setLoading(false);
    };

    if (contractId) {
      loadPeriods();
    }
  }, [contractId]);

  if (loading) return <div>กำลังโหลด...</div>;

  return (
    <div className="space-y-4">
      {periods.map(period => (
        <div key={period.id} className="border rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-medium">{period.description}</h3>
              <p className="text-sm text-gray-600">
                งวดที่ {period.period_no} | ครบกำหนด: {formatDate(period.due_date)}
              </p>
              <p className="text-lg font-semibold text-green-600">
                {formatCurrency(period.amount)}
              </p>
            </div>
            <StatusBadge status={period.status} />
          </div>
        </div>
      ))}
    </div>
  );
};
```

## ⚠️ สิ่งที่ต้องระวัง:

1. **Authentication**: ต้องส่ง JWT token ใน Authorization header
2. **Error Handling**: ตรวจสอบ response status และจัดการ error
3. **Loading State**: แสดง loading indicator ขณะดึงข้อมูล
4. **Empty State**: จัดการกรณีที่ไม่มีข้อมูลงวดงาน

## 🔧 การทดสอบ:

```bash
# ทดสอบ API ด้วย curl
curl -X GET "http://localhost:5005/api/contracts/1/periods" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

curl -X GET "http://localhost:5005/api/periods" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Backend พร้อมใช้งานแล้ว! 🎉**
