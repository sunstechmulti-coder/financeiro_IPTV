# Test Credentials

## Admin Accounts
| Email | Password | Notes |
|-------|----------|-------|
| admin1@sunstech.com | Admin123! | Main test account with seeded data |
| admin2@sunstech.com | Admin123! | Secondary test account |
| admin3@sunstech.com | Admin123! | Test account |
| admin4@sunstech.com | Admin123! | Test account |
| admin5@sunstech.com | Admin123! | Test account |
| sunstechmulti@gmail.com | (varies) | User's personal account |

## Supabase
- URL: https://exotuwkjubprpobivmja.supabase.co
- Anon Key: (in .env.local)
- Service Role Key: (in .env.local)

## Reset Password
Para redefinir a senha de qualquer conta admin via terminal:
```bash
cd /app && python3 scripts/reset_password.py admin1@sunstech.com NovaSenha123!
```
