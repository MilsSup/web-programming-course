# 1. Login
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/auth/github/callback" `
    -ContentType "application/json" -Body '{"code": "test_nikita"}'
$token = $login.token
$headers = @{ Authorization = "Bearer $token" }

# 2. Categories
$categories = Invoke-RestMethod -Uri "http://localhost:3000/api/categories"

# 3. Session (ЗАМЕНИ ID_ИЗ_БАЗЫ НА РЕАЛЬНЫЙ ID)
$session = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/sessions" `
    -Headers $headers -ContentType "application/json" `
    -Body '{"categoryId": "cmmm03e3f0000p93kx7z6kseo", "questionCount": 5}'

# ВЫВОД РЕЗУЛЬТАТОВ (просто пишем имена переменных)
"--- LOGIN RESPONSE ---"
$login
"--- CATEGORIES LIST ---"
$categories
"--- CREATED SESSION ---"
$session