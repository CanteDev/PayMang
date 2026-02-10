import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CancelPage() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <XCircle className="w-16 h-16 text-red-500 mx-auto" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-red-700">Pago Cancelado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-gray-600">
                        El proceso de pago ha sido cancelado o no se pudo completar.
                    </p>
                    <div className="pt-4">
                        <Link href="/">
                            <Button variant="outline" className="w-full">
                                Intentar de nuevo
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
