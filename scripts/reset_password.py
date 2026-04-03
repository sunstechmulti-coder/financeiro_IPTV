#!/usr/bin/env python3
"""
Script para redefinir senhas de usuários no Supabase.
Uso: python3 reset_password.py <email> <nova_senha>
Exemplo: python3 reset_password.py admin1@sunstech.com NovaSenha123!
"""

import sys
import os

try:
    from supabase import create_client
except ImportError:
    print("Instalando supabase-py...")
    os.system("pip install supabase")
    from supabase import create_client

# Configurações do Supabase (mesmas do .env.local)
SUPABASE_URL = "https://exotuwkjubprpobivmja.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4b3R1d2tqdWJwcnBvYml2bWphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE0MjEwNSwiZXhwIjoyMDkwNzE4MTA1fQ.32gBCuXwPTXdGzCUc6gDKVBJrPKoXTrvaUxP9XfvmZk"

def list_users():
    """Lista todos os usuários."""
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    users = client.auth.admin.list_users()
    print("\n=== Usuários Cadastrados ===")
    for u in users:
        print(f"  Email: {u.email}  |  ID: {u.id}  |  Último login: {u.last_sign_in_at or 'Nunca'}")
    print()

def reset_password(email: str, new_password: str):
    """Redefine a senha de um usuário pelo email."""
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    # Encontrar o usuário
    users = client.auth.admin.list_users()
    target = None
    for u in users:
        if u.email and u.email.lower() == email.lower():
            target = u
            break
    
    if not target:
        print(f"Usuário '{email}' não encontrado.")
        return False
    
    # Atualizar senha
    client.auth.admin.update_user_by_id(
        target.id,
        {"password": new_password}
    )
    print(f"Senha do usuário '{email}' redefinida com sucesso!")
    return True

if __name__ == "__main__":
    if len(sys.argv) == 1 or sys.argv[1] == "--list":
        list_users()
    elif len(sys.argv) == 3:
        email = sys.argv[1]
        new_password = sys.argv[2]
        reset_password(email, new_password)
    else:
        print("Uso:")
        print("  Listar usuários:    python3 reset_password.py --list")
        print("  Redefinir senha:    python3 reset_password.py <email> <nova_senha>")
        print()
        print("Exemplo:")
        print("  python3 reset_password.py admin1@sunstech.com NovaSenha123!")
