import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRecentOrders } from "@/lib/dashboard/queries";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { OrderStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionError } from "@/components/dashboard/section-error";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/**
 * Últimos pedidos — sob demanda (sem Realtime; ver `lib/dashboard/queries.ts`).
 * Hoje sempre mostra o estado vazio, porque a Área do Cliente (que cria
 * pedidos, contrato seção 3.3) ainda não existe — é o estado real e
 * esperado desta sprint, não um bug.
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
                    <TableCell className="font-mono">{currencyFormatter.format(order.totalAmount)}</TableCell>
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
