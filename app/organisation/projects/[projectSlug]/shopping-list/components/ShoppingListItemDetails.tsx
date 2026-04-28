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
    const customerDecisionComment = item.customerDecisionComment?.trim();
    const customerDecisionMeta = [
        item.customerDecisionByName,
        item.customerDecisionUpdatedAt ? format(new Date(item.customerDecisionUpdatedAt), "MMM dd, yyyy HH:mm") : null,
    ].filter(Boolean).join(" - ");

    return (
        <div className="grid grid-cols-1 gap-4 text-sm text-muted-foreground sm:grid-cols-2 md:grid-cols-3">
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
            {customerDecisionComment && (
                <div className="col-span-2 md:col-span-3">
                    <span className="font-medium text-foreground">Customer portal comment:</span>
                    {customerDecisionMeta ? (
                        <span className="ml-2 text-xs text-muted-foreground">{customerDecisionMeta}</span>
                    ) : null}
                    <p className="mt-1 text-foreground">{customerDecisionComment}</p>
                </div>
            )}
        </div>
    )
} 
