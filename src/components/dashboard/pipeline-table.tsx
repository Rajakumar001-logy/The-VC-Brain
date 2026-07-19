import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, stageBadgeVariant, stageLabel } from "@/lib/format";
import { pipeline } from "@/lib/mock-data";
import { formatDistanceToNow } from "date-fns";

export function PipelineTable() {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Active pipeline</CardTitle>
        <CardDescription>Deals currently in diligence and beyond</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Ask</TableHead>
              <TableHead className="text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pipeline.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">{item.sector}</TableCell>
                <TableCell>
                  <Badge variant={stageBadgeVariant(item.stage)}>
                    {stageLabel(item.stage)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.amount, true)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
