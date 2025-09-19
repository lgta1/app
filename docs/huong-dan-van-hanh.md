# 📋 Hướng dẫn Vận hành Project

## 🚀 Công nghệ sử dụng

- **Frontend**: React Router V7 + TypeScript
- **Database**: MongoDB (local hoặc Atlas)
- **File Storage**: MinIO/Cloudflare R2
- **UI Framework**: TailwindCSS
- **Process Manager**: PM2
- **Package Manager**: npm

## ⚙️ Cài đặt & Chạy

### 1. Cài đặt Dependencies
```bash
npm install
```

### 2. Development Mode
```bash
npm run dev
```
- Chạy trên port mặc định (thường là 5173)
- Hot reload tự động

### 3. Production Build
```bash
npm run build
```

### 4. Production với PM2
```bash
# Chạy bằng script quản lý
./manage.sh start

# Hoặc trực tiếp
pm2 start ecosystem.config.cjs
```

## 📁 File cấu hình quan trọng

### `ecosystem.config.cjs` - PM2 Configuration
- Cấu hình chạy production với PM2
- Mặc định: 2 instances, port 3001-3002
- Environment variables đã được cấu hình sẵn:
  - MongoDB connection
  - MinIO/R2 storage settings
  - NODE_ENV=production

### `manage.sh` - Script Quản lý
```bash
./manage.sh start      # Khởi động app
./manage.sh stop       # Dừng app  
./manage.sh restart    # Khởi động lại
./manage.sh status     # Xem trạng thái
./manage.sh logs       # Xem logs
./manage.sh monitor    # Monitor app
./manage.sh scale 2    # Scale tới N instances, phòng cho sau này server có nhiều cpu mạnh hơn có thể scale nhiều hơn
```

### `package.json` - Scripts
- `npm run dev`: Development mode
- `npm run build`: Build production  
- `npm start`: Chạy production server
- `npm run typecheck`: Kiểm tra TypeScript
- `npm run lint`: Kiểm tra code style, và fix nếu có thể

## 🔧 Environment Variables

Các biến môi trường được cấu hình trong `ecosystem.config.cjs`:

```javascript
// Database
MONGO_URL: "mongodb://admin:yourpassword@localhost:27017/..."

// Storage (Cloudflare R2)
MINIO_ENDPOINT: "f6de453e5fe8af5525fa232b5a6f498a.r2.cloudflarestorage.com"
MINIO_USE_SSL: "true"  
MINIO_ACCESS_KEY: "your-access-key"
MINIO_SECRET_KEY: "your-secret-key"
MINIO_DEFAULT_BUCKET: "vnht-images"

// App
NODE_ENV: "production"
PORT: 3001 (3002, 3003...)
```

## 📊 Monitoring & Logs

### Xem trạng thái PM2
```bash
pm2 status
# hoặc
pm2 ls
```

### Xem logs
```bash
pm2 logs                    # Tất cả logs
pm2 logs ww-1              # Instance cụ thể
./manage.sh logs           # Bằng script
```

### Log files location
```
logs/
├── ww-1-error.log         # Error logs instance 1
├── ww-1-out.log          # Output logs instance 1  
├── ww-1-combined.log     # Combined logs instance 1
├── ww-2-error.log        # Error logs instance 2
└── ...
```

### Monitor realtime
```bash
pm2 monit
# hoặc
./manage.sh monitor
```

## 🔍 Kiểm tra Health

### API Test
```bash
# Kiểm tra API hoạt động
curl http://localhost:3001/api/genres/debug

# Response mong đợi:
{"count": 111, "status": "ok"}
```

### Kiểm tra port listening
```bash
ss -ltnp | grep ':3001'
```

## 🛠️ Troubleshooting

### App không start được
1. Kiểm tra logs: `pm2 logs`
2. Kiểm tra port đã được sử dụng: `ss -ltnp | grep :3001`
3. Restart: `./manage.sh restart`

### Database connection lỗi
1. Kiểm tra MongoDB running
2. Kiểm tra MONGO_URL trong ecosystem.config.cjs
3. Test connection: `mongosh "mongodb://..."`

## 🗄️ Truy cập MongoDB Shell

### Kết nối với Database cụ thể
```bash
# Kết nối trực tiếp với database
sudo docker exec -it mongodb mongosh "mongodb://admin:yourpassword@localhost:27017"
> use your_database_name
> show collections
```

### Các lệnh MongoDB hữu ích
```bash
# Xem tất cả databases
show dbs

# Chuyển sang database
use your_database_name

# Xem collections
show collections

# Xem documents trong collection
db.collection_name.find().limit(10)

# Đếm documents
db.collection_name.countDocuments()

# Xem stats database
db.stats()
```

### File upload không hoạt động
1. Kiểm tra MinIO/R2 credentials
2. Test R2 connection với script: `node tools/r2-smoke.mjs`
3. Kiểm tra bucket permissions

## 📈 Scaling

### Scale instances
```bash
# Scale lên 4 instances
./manage.sh scale 4

# Hoặc edit ecosystem.config.cjs
# const instances = 4; 
pm2 restart ecosystem.config.cjs
```

### Performance tuning
- Mỗi instance limit 1GB RAM (tự restart khi vượt quá)
- Min uptime: 10s
- Max restarts: 5 lần

## 🔄 Deploy Process

```bash
# 1. Pull code mới
git pull origin main

# 2. Install dependencies (nếu có thay đổi)
npm install

# 3. Build
npm run build

# 4. Restart PM2
./manage.sh restart

# 5. Kiểm tra
./manage.sh status
curl http://localhost:3001/api/genres/debug
```

## 📞 Support

- **Logs**: `./logs/` directory
- **Config**: `ecosystem.config.cjs` 
- **Scripts**: `./manage.sh`
- **API Test**: `/api/genres/debug`
