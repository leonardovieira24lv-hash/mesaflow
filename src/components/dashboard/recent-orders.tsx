import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRecentOrders } from "@/lib/dashboard/queries";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { OrderStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionError } from "@/components/dashboard/section-error";
import { formatCurrency } from "@/lib/format";

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/**
 * Últimos pedidos — sob demanda (sem Realtime; ver `lib/dashboard/queries.ts`).
 *
 * Nota (Sprint 10, auditoria de qualidade): o comentário original desta
 * função dizia que a lista "sempre mostra o estado vazio, porque a Área do
 * Cliente ainda não existe" — isso descrevia o estado da Sprint 5 e ficou
 * desatualizado assim que a Sprint 8 implementou a criação de pedidos
 * (contrato 3.3). `getRecentOrders` já consulta a tabela `orders` de verdade
 * e não precisou de nenhuma mudança para isso — só a documentação estava
 * errada, corrigida aqui.
 */
export async function RecentOrders({ restaurantId }: { restaurantId: string }) {
  try {
    const supabase = await createClient();
    const orders = await getRecentOrders(supabase, restaurantId);

    return (
      <Card>
        <CardHeader>
          <CardTitle>Últimos pedidos</CardTitle>
          <CardDescription>Atualização sob demanda — tempo real chega no módulo de Pedidos.</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Nenhum pedido ainda"
              description="Assim que um cliente pedir pela mesa, ele aparece aqui."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mesa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Horário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono">{order.tableName}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="font-mono">{formatCurrency(order.totalAmount)}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {timeFormatter.format(new Date(order.createdAt))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  } catch {
    return <SectionError message="Não foi possível carregar os pedidos agora." />;
  }
}
