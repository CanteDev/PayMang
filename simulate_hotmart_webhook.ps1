$headers = @{
    "Content-Type" = "application/json"
    "x-hotmart-hottok" = "your-webhook-secret" # Mismo que en .env
}

$body = @{
    event = "PURCHASE_COMPLETE"
    data = @{
        product = @{
            id = 7192262
            name = "Pack Basico"
        }
        purchase = @{
            transaction = "HP" + (Get-Random -Minimum 100000 -Maximum 999999)
            price = @{
                value = 100.00
                currency_code = "EUR"
            }
            status = "APPROVED"
            # Importante: Hotmart envía el src (link_id) aquí
            src = "khv6umB5" 
            custom_fields = @{
                link_id = "khv6umB5"
            }
        }
        buyer = @{
            email = "comprador_test@example.com"
            name = "Comprador Test"
        }
    }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:3000/api/webhooks/hotmart" -Method Post -Headers $headers -Body $body
