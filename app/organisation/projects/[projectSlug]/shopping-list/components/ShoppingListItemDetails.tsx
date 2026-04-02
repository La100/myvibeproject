import { Badge } from "@/components/ui/badge";
import { Doc } from "@/convex/_generated/dataModel";
import type { TeamMember } from "@/lib/teamMember";
import { format } from "date-fns";

type ShoppingListItem = Doc<"shoppingListItems">;

interface ShoppingListItemDetailsProps {
    item: ShoppingListItem;
    teamMembers?: TeamMember[];
}

export function ShoppingListItemDetails({ item, teamMembers }: ShoppingListItemDetailsProps) {
    const assignedMemberName = item.assignedTo
        ? teamMembers?.find((member) => member.clerkUserId === item.assignedTo)?.name || item.assignedTo
        : undefined;

    return (
        <div className="mt-4 grid grid-cols-1 gap-4 text-sm text-muted-foreground sm:grid-cols-2 md:grid-cols-3">
            {item.priority && (
                <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Priority:</span>
                    <Badge variant={
                        item.priority === 'high' || item.priority === 'urgent' ? 'destructive' : 'secondary'
                    }>
                        {item.priority}
                    </Badge>
                </div>
            )}
            {item.buyBefore && (
                <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Buy Before:</span>
                    <span>{format(new Date(item.buyBefore), 'MMM dd, yyyy')}</span>
                </div>
            )}
            {item.supplier && (
                <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Supplier:</span>
                    <span>{item.supplier}</span>
                </div>
            )}
            {item.category && (
                <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Category:</span>
                    <span>{item.category}</span>
                </div>
            )}
            {item.dimensions && (
                <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Dimensions:</span>
                    <span>{item.dimensions}</span>
                </div>
            )}
            {item.catalogNumber && (
                <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Catalog #:</span>
                    <span>{item.catalogNumber}</span>
                </div>
            )}
            {item.productLink && (
                <div className="flex items-center gap-2 col-span-2 md:col-span-1">
                    <span className="font-medium text-foreground">Link:</span>
                    <a href={item.productLink} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline">
                        {item.productLink}
                    </a>
                </div>
            )}
            {item.assignedTo && (
                <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Assigned To:</span>
                    <span>{assignedMemberName}</span>
                </div>
            )}
            {item.notes && (
                <div className="col-span-2 md:col-span-3">
                    <span className="font-medium text-foreground">Notes:</span>
                    <p className="mt-1 text-foreground">{item.notes}</p>
                </div>
            )}
        </div>
    )
} 
