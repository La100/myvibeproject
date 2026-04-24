"use client";

import React, { useState } from 'react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Grid2X2, List, MoreHorizontal, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { ProductModal } from "./components/ProductModal";
import { AddToProjectModal } from "./components/AddToProjectModal";
import { cn, formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export default function ProductLibraryPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedProduct, setSelectedProduct] = useState<{ _id: string; name: string; brand?: string; model?: string; sku?: string; supplierSku?: string; dimensions?: string; weight?: number; material?: string; color?: string; unitPrice?: number; supplier?: string; category?: string; tags: string[]; description?: string; notes?: string; creatorName?: string; _creationTime: number; imageUrl?: string; productLink?: string; } | null>(null);
  const [showAddToProjectModal, setShowAddToProjectModal] = useState<{ _id: string; name: string; brand?: string; imageUrl?: string; } | null>(null);

  // Queries
  const products = useQuery(apiAny.productLibrary.getAllProducts, 
    team ? { teamId: team._id } : "skip"
  );
  
  const categories = useQuery(apiAny.productLibrary.getCategories, 
    team ? { teamId: team._id } : "skip"
  );
  
  const suppliers = useQuery(apiAny.productLibrary.getSuppliers, 
    team ? { teamId: team._id } : "skip"
  );

  // Filter products
  const filteredProducts = products?.filter(product => {
    const matchesSearch = searchTerm === "" || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const matchesSupplier = selectedSupplier === "all" || product.supplier === selectedSupplier;
    
    return matchesSearch && matchesCategory && matchesSupplier;
  }) || [];

  const ProductCard = ({ product }: { product: { _id: string; name: string; brand?: string; description?: string; category?: string; supplier?: string; unitPrice?: number; imageUrl?: string; tags: string[]; _creationTime: number; } }) => (
    <article
      className="group cursor-pointer"
      onClick={() => setSelectedProduct(product)}
    >
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-card transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-foreground/15 group-hover:shadow-[0_16px_36px_-24px_rgba(15,15,15,0.28)]">
        <div className="h-36 bg-secondary/70 p-3 sm:aspect-square sm:h-auto sm:p-8">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-[1.25rem] border border-dashed border-border/70 bg-secondary/70 text-sm text-muted-foreground">
              No preview
            </div>
          )}
        </div>

        <div className="absolute right-3 top-3 flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className="bg-card backdrop-blur-sm"
            onClick={(event) => {
              event.stopPropagation();
              setShowAddToProjectModal(product);
            }}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className="bg-card backdrop-blur-sm"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedProduct(product);
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 px-1 pb-1 pt-3">
        <div className="min-w-0">
          <h2 className="truncate text-[1.05rem] font-medium tracking-[-0.02em] text-foreground">
            {product.name}
          </h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="truncate">{product.brand || product.supplier || "Unassigned brand"}</span>
            {product.category ? <span className="h-1 w-1 rounded-full bg-border" /> : null}
            {product.category ? <span className="truncate">{product.category}</span> : null}
          </div>
        </div>
        {product.unitPrice ? (
          <span className="shrink-0 pt-0.5 text-sm font-medium text-foreground/80">
            {formatCurrency(product.unitPrice, team?.currency || 'USD', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
          </span>
        ) : null}
      </div>
    </article>
  );

  const ProductRow = ({ product }: { product: { _id: string; name: string; brand?: string; description?: string; category?: string; supplier?: string; unitPrice?: number; imageUrl?: string; tags: string[]; _creationTime: number; } }) => (
    <article
      className="group flex cursor-pointer items-center gap-4 rounded-[1.5rem] border border-border/60 bg-card px-4 py-3 transition-all duration-200 hover:border-foreground/15 hover:shadow-[0_12px_30px_-24px_rgba(15,15,15,0.25)]"
      onClick={() => setSelectedProduct(product)}
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.25rem] bg-secondary/70 p-3">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="text-xs text-muted-foreground">No preview</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-medium tracking-[-0.02em]">{product.name}</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {[product.brand, product.category, product.supplier].filter(Boolean).join(" • ") || "No metadata yet"}
            </p>
          </div>
          {product.unitPrice ? (
            <span className="shrink-0 text-sm font-medium text-foreground/80">
              {formatCurrency(product.unitPrice, team?.currency || 'USD', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            setShowAddToProjectModal(product);
          }}
        >
          <ShoppingCart className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedProduct(product);
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <div className="border-b border-border/70 bg-background/95 px-5 py-4 backdrop-blur md:px-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="font-serif text-[2rem] leading-none tracking-[-0.04em] text-foreground">
              Product Library
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Browse, search, and reuse approved products across the studio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <div className="relative min-w-[220px] flex-1 xl:w-[320px] xl:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-2xl border-border/70 bg-card pl-10 shadow-none"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-10 w-full rounded-2xl border-border/70 bg-card md:w-[180px]">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="All categories" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger className="h-10 w-full rounded-2xl border-border/70 bg-card md:w-[180px]">
                <SelectValue placeholder="All suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers?.map(supplier => (
                  <SelectItem key={supplier} value={supplier}>
                    {supplier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center rounded-2xl border border-border/70 bg-card p-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "rounded-xl",
                  viewMode === "grid" && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                )}
              >
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setViewMode("list")}
                className={cn(
                  "rounded-xl",
                  viewMode === "list" && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                )}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            <Button asChild className="h-10 rounded-2xl px-4">
              <Link href="/organisation/product-library/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-6 md:px-7">
        {filteredProducts.length === 0 ? (
          <EmptyState
            title="Start building your product library"
            description="Save materials, furniture, fixtures, and lighting once, then pull them into projects whenever you need them."
            action={{
              label: "Add a Product",
              onClick: () => router.push("/organisation/product-library/new"),
              icon: Plus,
            }}
            className="border-0 bg-card"
          />
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}
              </p>
            </div>

            <div
              className={cn(
                "gap-x-5 gap-y-7",
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
                  : "flex flex-col",
              )}
            >
              {filteredProducts.map(product => (
                viewMode === "grid" ? (
                  <ProductCard key={product._id} product={product} />
                ) : (
                  <ProductRow key={product._id} product={product} />
                )
              ))}
            </div>
          </>
        )}
      </div>

      {selectedProduct && team && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          teamCurrency={team?.currency || 'USD'}
          teamId={team._id}
        />
      )}

      {showAddToProjectModal && team && (
        <AddToProjectModal
          product={showAddToProjectModal}
          teamId={team._id}
          onClose={() => setShowAddToProjectModal(null)}
        />
      )}
    </div>
  );
}
