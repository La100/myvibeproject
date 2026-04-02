"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { Loader2, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import { Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface AddProductFormProps {
  teamId: Id<"teams">;
  currencySymbol?: string;
  cancelHref?: string;
}

export function AddProductForm({
  teamId,
  currencySymbol = "zł",
  cancelHref = "/organisation/product-library",
}: AddProductFormProps) {
  const router = useRouter();
  const { user } = useUser();
  const createProduct = useMutation(apiAny.productLibrary.createProduct);

  const [name, setName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [category, setCategory] = useState("");
  const [catalogNumber, setCatalogNumber] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [productLink, setProductLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScraping, setIsScraping] = useState(false);

  const normalizeProductUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid URL protocol");
    }
    return parsed.toString();
  };

  const handleScrapeByUrl = async () => {
    const rawUrl = productLink.trim();
    if (!rawUrl || isScraping) {
      return;
    }

    let normalizedUrl = "";
    try {
      normalizedUrl = normalizeProductUrl(rawUrl);
    } catch {
      toast.error("Invalid product URL");
      return;
    }

    setIsScraping(true);
    setProductLink(normalizedUrl);

    try {
      const response = await fetch(`/api/shopping/scrape?url=${encodeURIComponent(normalizedUrl)}`);
      const payload = (await response.json()) as {
        message?: string;
        name?: string;
        supplier?: string;
        category?: string;
        catalogNumber?: string;
        dimensions?: string;
        unitPrice?: number;
        productLink?: string;
        imageUrl?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message || "Failed to scrape product details");
      }

      if (payload.name) setName(payload.name);
      if (payload.supplier) setSupplier(payload.supplier);
      if (payload.category) setCategory(payload.category);
      if (payload.catalogNumber) setCatalogNumber(payload.catalogNumber);
      if (payload.dimensions) setDimensions(payload.dimensions);
      if (typeof payload.unitPrice === "number" && Number.isFinite(payload.unitPrice)) {
        setUnitPrice(String(payload.unitPrice));
      }
      if (payload.imageUrl) setImageUrl(payload.imageUrl);
      if (payload.productLink) setProductLink(payload.productLink);

      toast.success("Product details imported from URL");
    } catch (error) {
      toast.error((error as Error).message || "Could not import product details");
    } finally {
      setIsScraping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Product name is required");
      return;
    }

    if (!user?.id) {
      toast.error("User session is not ready yet");
      return;
    }

    let normalizedProductLink: string | undefined;
    if (productLink.trim()) {
      try {
        normalizedProductLink = normalizeProductUrl(productLink);
      } catch {
        toast.error("Invalid product URL");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await createProduct({
        name: name.trim(),
        supplier: supplier.trim() || undefined,
        category: category.trim() || undefined,
        sku: catalogNumber.trim() || undefined,
        dimensions: dimensions.trim() || undefined,
        unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
        productLink: normalizedProductLink,
        imageUrl: imageUrl.trim() || undefined,
        tags: [],
        teamId,
        createdBy: user.id,
      });

      toast.success("Product added successfully");
      router.push("/organisation/product-library");
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error("Failed to add product");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-5xl flex-col gap-6">
      <Card>
        <CardContent className="p-6">
          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field className="gap-2">
              <FieldLabel>Product Name *</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kitchen Countertop Navona"
                className="h-12 text-sm"
                required
              />
            </Field>

            <Field className="gap-2">
              <FieldLabel>Supplier</FieldLabel>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. kronosfera.pl"
                className="h-12 text-sm"
              />
            </Field>

            <Field className="gap-2">
              <FieldLabel>Catalog Number</FieldLabel>
              <Input
                value={catalogNumber}
                onChange={(e) => setCatalogNumber(e.target.value)}
                placeholder="e.g. BU1K367PH-3BC1"
                className="h-12 text-sm"
              />
            </Field>

            <Field className="gap-2">
              <FieldLabel>Category</FieldLabel>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Furniture"
                className="h-12 text-sm"
              />
            </Field>

            <Field className="gap-2">
              <FieldLabel>Dimensions</FieldLabel>
              <Input
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                placeholder="e.g. 4100 x 1200"
                className="h-12 text-sm"
              />
            </Field>

            <Field className="gap-2">
              <FieldLabel>Unit Price ({currencySymbol})</FieldLabel>
              <Input
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="h-12 text-sm"
              />
            </Field>

            <Field className="gap-2 lg:col-span-2">
              <FieldLabel>Product Link</FieldLabel>
              <div className="flex gap-2">
                <Input
                  value={productLink}
                  onChange={(e) => setProductLink(e.target.value)}
                  placeholder="https://..."
                  className="h-12 flex-1 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting || isScraping || !productLink.trim()}
                  onClick={handleScrapeByUrl}
                  className="h-12 shrink-0 px-4"
                >
                  {isScraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                  <span className="ml-2 hidden xl:inline">{isScraping ? "Scraping..." : "Auto-fill"}</span>
                </Button>
              </div>
            </Field>

            <Field className="gap-2">
              <FieldLabel>Image URL</FieldLabel>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="h-12 text-sm"
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button asChild variant="outline" className="h-11 px-5">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || isScraping || !name.trim()}
          className="h-11 px-6"
        >
          {isSubmitting ? "Adding..." : "Add Product"}
        </Button>
      </div>
    </form>
  );
}
