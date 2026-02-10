import UnifiedLinkGenerator from '@/components/admin/UnifiedLinkGenerator';

export default function CloserLinksPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Generar Link</h1>
                <p className="text-gray-600 mt-1">Crea enlaces de pago para tus cierres</p>
            </div>
            <div className="flex justify-center">
                <UnifiedLinkGenerator />
            </div>
        </div>
    );
}
