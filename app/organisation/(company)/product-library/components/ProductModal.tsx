"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, ExternalLink, Package, Ruler, Palette, Tag, User, Calendar, Edit } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { AddToProjectModal } from "./AddToProjectModal";
import { EditProductModal } from "./EditProductModal";
import { Id } from "@/convex/_generated/dataModel";

interface ProductModalProps {
  product: { _id: string; name: string; brand?: string; model?: string; sku?: string; supplierSku?: string; dimensions?: string; weight?: number; material?: string; color?: string; unitPrice?: number; supplier?: string; category?: string; tags: string[]; description?: string; notes?: string; creatorName?: string; _creationTime: number; imageUrl?: string; productLink?: string; };
  onClose: () => void;
  teamCurrency: string;
  teamId: Id<"teams">;
}

export function ProductModal({ product, onClose, teamCurrency, teamId }: ProductModalProps) {
  const [showAddToProjectModal, setShowAddToProjectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          {product.name}
        </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {/* Product Image */}
          {product.imageUrl && (
            <div className="flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-muted p-3 sm:h-72 sm:p-4 md:h-80">
              <img 
                src={product.imageUrl} 
                alt={product.name}
                className="h-full w-full object-contain"
              />
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="font-semibold mb-2">Product Details</h3>
                <div className="flex flex-col gap-2 text-sm">
                  {product.brand && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Brand:</span>
                      <span>{product.brand}</span>
                    </div>
                  )}
                  {product.model && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Model:</span>
                      <span>{product.model}</span>
                    </div>
                  )}
                  {product.sku && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">SKU:</span>
                      <span>{product.sku}</span>
                    </div>
                  )}
                  {product.supplierSku && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Supplier SKU:</span>
                      <span>{product.supplierSku}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Physical Properties */}
              {(product.dimensions || product.weight || product.material || product.color) && (
                <div>
                  <h3 className="font-semibold mb-2">Physical Properties</h3>
                  <div className="flex flex-col gap-2 text-sm">
                    {product.dimensions && (
                      <div className="flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-muted-foreground" />
                        <span>{product.dimensions}</span>
                      </div>
                    )}
                    {product.weight && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Weight:</span>
                        <span>{product.weight} kg</span>
                      </div>
                    )}
                    {product.material && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Material:</span>
                        <span>{product.material}</span>
                      </div>
                    )}
                    {product.color && (
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-muted-foreground" />
                        <span>{product.color}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {/* Pricing & Availability */}
              <div>
                <h3 className="font-semibold mb-2">Pricing & Availability</h3>
                <div className="flex flex-col gap-2">
                  {product.unitPrice && (
                    <div className="text-xl font-bold">
                      {formatCurrency(product.unitPrice, teamCurrency)}
                    </div>
                  )}
                </div>
              </div>

              {/* Supplier Info */}
              {product.supplier && (
                <div>
                  <h3 className="font-semibold mb-2">Supplier</h3>
                  <p className="text-sm">{product.supplier}</p>
                </div>
              )}

              {/* Category & Tags */}
              <div className="flex flex-col gap-3">
                {product.category && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Category</h4>
                    <Badge variant="secondary">{product.category}</Badge>
                  </div>
                )}
                
                {product.tags.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      Tags
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {product.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </div>
            </>
          )}

          {/* Notes */}
          {product.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {product.notes}
                </p>
              </div>
            </>
          )}

          {/* Meta Info */}
          <Separator />
          <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>Added by {product.creatorName || "Unknown User"}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{new Date(product._creationTime).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="h-11 w-full justify-start rounded-2xl px-4 sm:flex-1 sm:justify-center"
              onClick={() => setShowAddToProjectModal(true)}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Add to Project
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full justify-start rounded-2xl px-4 sm:w-auto sm:justify-center"
              onClick={() => setShowEditModal(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            {product.productLink && (
              <Button
                variant="outline"
                className="h-11 w-full justify-start rounded-2xl px-4 sm:w-auto sm:justify-center"
                asChild
              >
                <a href={product.productLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Product
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Add to Project Modal */}
    {showAddToProjectModal && (
      <AddToProjectModal
        product={product}
        teamId={teamId}
        onClose={() => setShowAddToProjectModal(false)}
      />
    )}

    {/* Edit Product Modal */}
    {showEditModal && (
      <EditProductModal
        product={product}
        onClose={() => setShowEditModal(false)}
      />
    )}
    </>
  );
}
