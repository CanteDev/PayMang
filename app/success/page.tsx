import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SuccessPage() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="flexjustify-center mb-4">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-green-700">¡Pago Exitoso!</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-gray-600">
                        Gracias por tu compra. Hemos procesado tu pago correctamente.
                    </p>
                    <p className="text-sm text-gray-500">
                        Recibirás un correo electrónico con los detalles de tu pedido.
                    </p>
                    <div className="pt-4">
                        <Link href="/">
                            <Button className="w-full">
                                Volver al Inicio
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
