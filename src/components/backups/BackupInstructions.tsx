import { useState } from "react";
import { Info, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Lock, Zap, Package } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const BackupInstructions = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="mb-6 border-primary/20 bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Guía de Uso: Sistema de Backup Completo</CardTitle>
              <CardDescription>
                Aprende a crear, descargar y restaurar backups completos con imágenes
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Ocultar
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Ver Guía
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {/* Sección 1: ¿Qué es un Backup Completo? */}
            <AccordionItem value="what-is">
              <AccordionTrigger className="text-lg font-semibold">
                ¿Qué es un Backup Completo?
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <p className="text-muted-foreground">
                  Un backup completo incluye todos los datos necesarios para recuperar tus tours al 100%:
                </p>
                <div className="grid gap-3 ml-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Estructura JSON de todos tus tours</p>
                      <p className="text-sm text-muted-foreground">
                        Configuración completa, hotspots, metadata
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Todas las imágenes físicas</p>
                      <p className="text-sm text-muted-foreground">
                        Panoramas 360°, floor plans, imágenes de hotspots
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Datos del tenant y estadísticas</p>
                      <p className="text-sm text-muted-foreground">
                        Información de vistas, comentarios, configuraciones
                      </p>
                    </div>
                  </div>
                </div>

                <Alert className="mt-4 bg-primary/5 border-primary/20">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    <strong>Ventajas:</strong> Recuperación 100% completa, funciona aunque pierdas acceso a tu cuenta,
                    puedes migrar tours a otra aplicación, no depende del storage en la nube.
                  </AlertDescription>
                </Alert>
              </AccordionContent>
            </AccordionItem>

            {/* Sección 2: Cómo Crear un Backup */}
            <AccordionItem value="create">
              <AccordionTrigger className="text-lg font-semibold">
                Cómo Crear un Backup Completo
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <ol className="space-y-3 ml-4 list-decimal list-outside">
                  <li className="pl-2">
                    <strong>Click en "Crear Backup"</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      Botón ubicado en la parte superior de esta página
                    </p>
                  </li>
                  <li className="pl-2">
                    <strong>Ingresa un nombre descriptivo</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ejemplo: "Backup mensual octubre 2025" o "Pre-actualización"
                    </p>
                  </li>
                  <li className="pl-2">
                    <strong>(Opcional) Agrega notas</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      Para recordar el propósito o contexto del backup
                    </p>
                  </li>
                  <li className="pl-2">
                    <strong>Click en "Crear Backup"</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      El sistema generará automáticamente el backup
                    </p>
                  </li>
                  <li className="pl-2">
                    <strong>Espera confirmación</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      Verás una notificación de éxito cuando esté listo
                    </p>
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            {/* Sección 3: Cómo Descargar */}
            <AccordionItem value="download">
              <AccordionTrigger className="text-lg font-semibold">
                Cómo Descargar un Backup Completo
              </AccordionTrigger>
              <AccordionContent className="space-y-6">
                {/* Opción A: JSON Solo */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Opción A: Solo JSON (rápido, sin imágenes)</h4>
                  </div>
                  <ol className="space-y-2 ml-4 list-decimal list-outside text-sm">
                    <li className="pl-2">En la tabla de backups, click en el icono 📄 (FileJson)</li>
                    <li className="pl-2">El archivo JSON se descargará inmediatamente</li>
                    <li className="pl-2">Tamaño: Pequeño (~100KB - 5MB)</li>
                  </ol>
                  <Alert className="mt-3 bg-destructive/10 border-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-sm">
                      <strong>Advertencia:</strong> NO incluye imágenes físicas, solo URLs y estructura
                    </AlertDescription>
                  </Alert>
                </div>

                {/* Opción B: ZIP Completo */}
                <div className="border rounded-lg p-4 bg-primary/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Opción B: Backup Completo (con todas las imágenes)</h4>
                    <Badge variant="outline" className="ml-auto">Recomendado</Badge>
                  </div>
                  <ol className="space-y-2 ml-4 list-decimal list-outside text-sm">
                    <li className="pl-2">En la tabla de backups, click en el icono 📦 (PackageOpen)</li>
                    <li className="pl-2">El sistema comenzará a preparar el backup completo</li>
                    <li className="pl-2">
                      Se mostrarán indicadores de progreso:
                      <ul className="list-disc ml-6 mt-1 space-y-1 text-muted-foreground">
                        <li>"Preparando backup..."</li>
                        <li>"Descargando imágenes X/Y"</li>
                        <li>Tamaño estimado del archivo</li>
                      </ul>
                    </li>
                    <li className="pl-2">Cuando complete, el archivo JSON se descargará automáticamente</li>
                    <li className="pl-2">Tamaño: Variable (10MB - 500MB+ dependiendo de imágenes)</li>
                  </ol>
                  <Alert className="mt-3 bg-primary/10 border-primary/20">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-sm">
                      <strong>Nota:</strong> Este proceso puede tardar varios minutos si tienes muchas imágenes.
                      El archivo descargado contiene las imágenes codificadas en base64.
                    </AlertDescription>
                  </Alert>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Sección 4: Cómo Restaurar */}
            <AccordionItem value="restore">
              <AccordionTrigger className="text-lg font-semibold">
                Cómo Restaurar desde un Backup Completo
              </AccordionTrigger>
              <AccordionContent className="space-y-6">
                {/* Restaurar JSON Solo */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">📁</span>
                    <h4 className="font-semibold">Restaurar JSON Solo</h4>
                  </div>
                  <ol className="space-y-2 ml-4 list-decimal list-outside text-sm">
                    <li className="pl-2">Click en "Restaurar JSON"</li>
                    <li className="pl-2">Selecciona tu archivo .json descargado</li>
                    <li className="pl-2">
                      Elige modo de restauración:
                      <div className="ml-4 mt-2 space-y-2">
                        <div className="flex items-start gap-2">
                          <Badge variant="secondary" className="mt-0.5">Aditivo</Badge>
                          <span className="text-muted-foreground">Mantiene tours existentes, agrega los del backup</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Badge variant="destructive" className="mt-0.5">Completo</Badge>
                          <span className="text-muted-foreground">⚠️ ELIMINA tours actuales, restaura solo los del backup</span>
                        </div>
                      </div>
                    </li>
                    <li className="pl-2">Click en "Restaurar"</li>
                  </ol>
                  <Alert className="mt-3 bg-destructive/10 border-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-sm">
                      <strong>Importante:</strong> Las imágenes NO se restaurarán (solo URLs y estructura)
                    </AlertDescription>
                  </Alert>
                </div>

                {/* Restaurar ZIP Completo */}
                <div className="border rounded-lg p-4 bg-primary/5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">📦</span>
                    <h4 className="font-semibold">Restaurar Backup Completo (con imágenes)</h4>
                    <Badge variant="outline" className="ml-auto">Recomendado</Badge>
                  </div>
                  <ol className="space-y-2 ml-4 list-decimal list-outside text-sm">
                    <li className="pl-2">Click en "Restaurar ZIP Completo"</li>
                    <li className="pl-2">Selecciona tu archivo JSON completo (con imágenes en base64)</li>
                    <li className="pl-2">
                      El sistema mostrará:
                      <ul className="list-disc ml-6 mt-1 space-y-1 text-muted-foreground">
                        <li>Tamaño del archivo</li>
                        <li>Estimación de tiempo</li>
                      </ul>
                    </li>
                    <li className="pl-2">
                      Elige modo de restauración:
                      <div className="ml-4 mt-2 space-y-2">
                        <div className="flex items-start gap-2">
                          <Badge variant="secondary" className="mt-0.5">Aditivo</Badge>
                          <span className="text-muted-foreground">Mantiene tours existentes</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Badge variant="destructive" className="mt-0.5">Completo</Badge>
                          <span className="text-muted-foreground">⚠️ ELIMINA todo y restaura desde cero</span>
                        </div>
                      </div>
                    </li>
                    <li className="pl-2">Click en "Subir y Restaurar"</li>
                    <li className="pl-2">
                      Observa el progreso:
                      <ul className="list-disc ml-6 mt-1 space-y-1 text-muted-foreground">
                        <li>Fase 1: Subiendo chunks (0-80%)</li>
                        <li>Fase 2: Procesando imágenes (80-90%)</li>
                        <li>Fase 3: Creando estructura de tours (90-100%)</li>
                      </ul>
                    </li>
                    <li className="pl-2">Espera confirmación de completado</li>
                  </ol>
                  <Alert className="mt-3 bg-primary/10 border-primary/20">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-sm">
                      <strong>Proceso completo:</strong> Todos los tours + imágenes restaurados.
                      Tiempo estimado: 5-15 minutos para backups grandes.
                    </AlertDescription>
                  </Alert>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Sección 5: Diferencias */}
            <AccordionItem value="differences">
              <AccordionTrigger className="text-lg font-semibold">
                Diferencias entre JSON y Backup Completo
              </AccordionTrigger>
              <AccordionContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">Característica</th>
                        <th className="text-center p-3 font-semibold">JSON Solo</th>
                        <th className="text-center p-3 font-semibold">Backup Completo</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="p-3">Velocidad descarga</td>
                        <td className="text-center p-3">
                          <Badge variant="secondary">⚡ Rápido</Badge>
                        </td>
                        <td className="text-center p-3">
                          <Badge variant="outline">🐢 Lento</Badge>
                        </td>
                      </tr>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="p-3">Tamaño archivo</td>
                        <td className="text-center p-3">
                          <Badge variant="secondary">📦 Pequeño</Badge>
                        </td>
                        <td className="text-center p-3">
                          <Badge variant="outline">📦📦📦 Grande</Badge>
                        </td>
                      </tr>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="p-3">Incluye imágenes</td>
                        <td className="text-center p-3">❌ No</td>
                        <td className="text-center p-3">✅ Sí</td>
                      </tr>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="p-3">Restauración 100%</td>
                        <td className="text-center p-3">❌ Parcial</td>
                        <td className="text-center p-3">✅ Total</td>
                      </tr>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="p-3">Portabilidad total</td>
                        <td className="text-center p-3">❌ No</td>
                        <td className="text-center p-3">✅ Sí</td>
                      </tr>
                      <tr className="hover:bg-muted/30">
                        <td className="p-3 font-medium">Uso recomendado</td>
                        <td className="text-center p-3 text-muted-foreground">Backup rápido</td>
                        <td className="text-center p-3 text-primary font-medium">Backup seguro</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Sección 6: Mejores Prácticas */}
            <AccordionItem value="best-practices">
              <AccordionTrigger className="text-lg font-semibold">
                Consejos y Mejores Prácticas
              </AccordionTrigger>
              <AccordionContent className="space-y-6">
                {/* Buenas Prácticas */}
                <div className="border rounded-lg p-4 bg-primary/5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold text-primary">Buenas Prácticas</h4>
                  </div>
                  <ul className="space-y-2 ml-4 list-disc list-outside text-sm">
                    <li className="pl-2">Crea backups completos cada mes o antes de cambios importantes</li>
                    <li className="pl-2">Guarda copias en múltiples lugares (PC, nube, disco externo)</li>
                    <li className="pl-2">Usa nombres descriptivos con fechas (ej: "2025-10-27-backup-completo")</li>
                    <li className="pl-2">Verifica la descarga antes de eliminar backups antiguos</li>
                    <li className="pl-2">Prueba restaurar en un ambiente de prueba primero</li>
                  </ul>
                </div>

                {/* Advertencias */}
                <div className="border rounded-lg p-4 bg-destructive/5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <h4 className="font-semibold text-destructive">Advertencias Importantes</h4>
                  </div>
                  <ul className="space-y-2 ml-4 list-disc list-outside text-sm">
                    <li className="pl-2">
                      <strong>El modo "Completo" elimina TODO</strong> - úsalo con extremo cuidado
                    </li>
                    <li className="pl-2">Backups grandes requieren conexión estable a internet</li>
                    <li className="pl-2">No cierres el navegador durante subidas/descargas</li>
                    <li className="pl-2">Verifica espacio disponible en disco antes de descargar</li>
                    <li className="pl-2">Ten un backup reciente antes de hacer cambios mayores</li>
                  </ul>
                </div>

                {/* Seguridad */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="h-5 w-5" />
                    <h4 className="font-semibold">Seguridad y Privacidad</h4>
                  </div>
                  <ul className="space-y-2 ml-4 list-disc list-outside text-sm">
                    <li className="pl-2">Los backups contienen datos sensibles de tus tours</li>
                    <li className="pl-2">No compartas archivos de backup públicamente</li>
                    <li className="pl-2">Encripta backups si los guardas en servicios de nube</li>
                    <li className="pl-2">Elimina backups antiguos de lugares inseguros</li>
                    <li className="pl-2">Mantén tus credenciales seguras al restaurar</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      )}
    </Card>
  );
};
