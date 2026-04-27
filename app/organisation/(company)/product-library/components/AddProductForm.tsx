"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiAny } from "@/lib/convexApiAny";
import { optimizeCoverImageForUpload } from "@/lib/coverImageUpload";
import { Id } from "@/convex/_generated/dataModel";
import { ImagePlus, Loader2, Plus, Upload, WandSparkles, X } from "lucide-react";
import { toast } from "sonner";
import { toUserFacingErrorMessage } from "@/lib/userFacingErrors";

interface AddProductFormProps {
  teamId: Id<"teams">;
  currencySymbol?: string;
  cancelHref?: string;
}

type ProductFormData = {
  name: string;
  description: string;
  category: string;
  brand: string;
  model: string;
  sku: string;
  imageUrl: string;
  productLink: string;
  supplier: string;
  supplierSku: string;
  dimensions: string;
  weight: string;
  material: string;
  color: string;
  unitPrice: string;
  notes: string;
};

const initialFormData: ProductFormData = {
  name: "",
  description: "",
  category: "",
  brand: "",
  model: "",
  sku: "",
  imageUrl: "",
  productLink: "",
  supplier: "",
  supplierSku: "",
  dimensions: "",
  weight: "",
  material: "",
  color: "",
  unitPrice: "",
  notes: "",
};

export function AddProductForm({
  teamId,
  currencySymbol = "zł",
  cancelHref = "/organisation/product-library",
}: AddProductFormProps) {
  const router = useRouter();
  const { user } = useUser();
  const createProduct = useMutation(apiAny.productLibrary.createProduct);
  const generateImageUploadUrl = useMutation(apiAny.productLibrary.generateImageUploadUrl);

  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const isImageBusy = isOptimizingImage || isUploadingImage;
  const hasImage = Boolean(formData.imageUrl.trim());

  const setField = (field: keyof ProductFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const normalizeUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid URL protocol");
    }
    return parsed.toString();
  };

  const addTag = () => {
    const nextTag = tagInput.trim();
    if (!nextTag) {
      return;
    }

    if (tags.includes(nextTag)) {
      setTagInput("");
      return;
    }

    setTags((current) => [...current, nextTag]);
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    setTags((current) => current.filter((tag) => tag !== tagToRemove));
  };

  const handleScrapeByUrl = async () => {
    const rawUrl = formData.productLink.trim();
    if (!rawUrl || isScraping) {
      return;
    }

    let normalizedUrl = "";
    try {
      normalizedUrl = normalizeUrl(rawUrl);
    } catch {
      toast.error("Invalid product URL");
      return;
    }

    setIsScraping(true);
    setField("productLink", normalizedUrl);

    try {
      const response = await fetch(
        `/api/shopping/scrape?teamId=${encodeURIComponent(String(teamId))}&url=${encodeURIComponent(normalizedUrl)}`,
      );
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

      if (payload.name) setField("name", payload.name);
      if (payload.supplier) setField("supplier", payload.supplier);
      if (payload.category) setField("category", payload.category);
      if (payload.catalogNumber) setField("sku", payload.catalogNumber);
      if (payload.dimensions) setField("dimensions", payload.dimensions);
      if (typeof payload.unitPrice === "number" && Number.isFinite(payload.unitPrice)) {
        setField("unitPrice", String(payload.unitPrice));
      }
      if (payload.imageUrl) setField("imageUrl", payload.imageUrl);
      if (payload.productLink) setField("productLink", payload.productLink);

      toast.success("Product details imported from URL");
    } catch (error) {
      toast.error("Could not import product details", {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsScraping(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5 MB");
      return;
    }

    let fileToUpload = file;
    setIsOptimizingImage(true);

    try {
      const optimized = await optimizeCoverImageForUpload(file);
      fileToUpload = optimized.file;

      if (optimized.optimized) {
        const savedKb = Math.max(1, Math.round((optimized.originalSize - optimized.file.size) / 1024));
        toast.success("Image optimized", {
          description: `Reduced by about ${savedKb} KB before upload.`,
        });
      }
    } catch {
      fileToUpload = file;
    } finally {
      setIsOptimizingImage(false);
    }

    setIsUploadingImage(true);

    try {
      const uploadData = await generateImageUploadUrl({
        teamId,
        fileName: fileToUpload.name,
        fileSize: fileToUpload.size,
      });

      const response = await fetch(uploadData.url, {
        method: "PUT",
        body: fileToUpload,
        headers: {
          "Content-Type": fileToUpload.type || "application/octet-stream",
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed (${response.status})`);
      }

      setField("imageUrl", uploadData.publicUrl);
      toast.success("Image uploaded");
    } catch (error) {
      toast.error("Failed to upload image", {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const handleImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await handleImageUpload(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    if (!user?.id) {
      toast.error("User session is not ready yet");
      return;
    }

    let normalizedProductLink: string | undefined;
    if (formData.productLink.trim()) {
      try {
        normalizedProductLink = normalizeUrl(formData.productLink);
      } catch {
        toast.error("Invalid product URL");
        return;
      }
    }

    if (isImageBusy) {
      toast.error("Wait for the image upload to finish");
      return;
    }

    const parsedUnitPrice = formData.unitPrice.trim() ? Number(formData.unitPrice) : undefined;
    if (
      formData.unitPrice.trim() &&
      (typeof parsedUnitPrice !== "number" || !Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0)
    ) {
      toast.error("Enter a valid price");
      return;
    }

    const parsedWeight = formData.weight.trim() ? Number(formData.weight) : undefined;
    if (
      formData.weight.trim() &&
      (typeof parsedWeight !== "number" || !Number.isFinite(parsedWeight) || parsedWeight < 0)
    ) {
      toast.error("Enter a valid weight");
      return;
    }

    setIsSubmitting(true);

    try {
      await createProduct({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category.trim() || undefined,
        brand: formData.brand.trim() || undefined,
        model: formData.model.trim() || undefined,
        sku: formData.sku.trim() || undefined,
        imageUrl: formData.imageUrl.trim() || undefined,
        productLink: normalizedProductLink,
        supplier: formData.supplier.trim() || undefined,
        supplierSku: formData.supplierSku.trim() || undefined,
        dimensions: formData.dimensions.trim() || undefined,
        weight: parsedWeight,
        material: formData.material.trim() || undefined,
        color: formData.color.trim() || undefined,
        unitPrice: parsedUnitPrice,
        tags,
        notes: formData.notes.trim() || undefined,
        teamId,
        createdBy: user.id,
      });

      toast.success("Product added successfully");
      router.push("/organisation/product-library");
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error("Failed to add product", {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-4xl flex-col gap-10">
      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Core product details visible in your team library.
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-lg border bg-card p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Product name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(event) => setField("name", event.target.value)}
                placeholder="e.g. Kitchen Countertop Navona"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(event) => setField("category", event.target.value)}
                placeholder="e.g. Furniture, Lighting"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(event) => setField("brand", event.target.value)}
                placeholder="Brand name"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(event) => setField("model", event.target.value)}
                placeholder="Model"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">
              Description <span className="font-normal text-muted-foreground">(Optional)</span>
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(event) => setField("description", event.target.value)}
              placeholder="Describe the product, finish, intended use or standout details"
              rows={4}
              className="resize-none"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold">Product image</h2>
          <p className="text-sm text-muted-foreground">
            Upload a photo directly or paste a source image URL if you already have one.
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-lg border bg-card p-6">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleImageFileChange(event);
            }}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => imageInputRef.current?.click()}
              disabled={isSubmitting || isScraping || isImageBusy}
            >
              {isImageBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-2 h-4 w-4" />
              )}
              {isOptimizingImage
                ? "Optimizing..."
                : isUploadingImage
                  ? "Uploading..."
                  : "Upload image"}
            </Button>

            {hasImage ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setField("imageUrl", "")}
                disabled={isSubmitting || isScraping || isImageBusy}
              >
                <X className="mr-2 h-4 w-4" />
                Remove image
              </Button>
            ) : null}
          </div>

          {hasImage ? (
            <div className="overflow-hidden rounded-lg border bg-secondary/70">
              <img
                src={formData.imageUrl}
                alt="Product preview"
                className="h-64 w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex min-h-56 items-center justify-center rounded-lg border border-dashed bg-secondary/70 px-6 text-center">
              <div className="max-w-sm flex flex-col gap-2">
                <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">No image selected yet</p>
                <p className="text-sm text-muted-foreground">
                  Uploaded images are compressed automatically before sending.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="imageUrl">
              Direct image URL <span className="font-normal text-muted-foreground">(Optional)</span>
            </Label>
            <Input
              id="imageUrl"
              value={formData.imageUrl}
              onChange={(event) => setField("imageUrl", event.target.value)}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground">
              Use this only when you want to link an existing hosted image instead of uploading a file.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold">Sourcing</h2>
          <p className="text-sm text-muted-foreground">
            Store supplier, pricing and purchase data for reuse in projects.
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-lg border bg-card p-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="productLink">Product link</Label>
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                id="productLink"
                value={formData.productLink}
                onChange={(event) => setField("productLink", event.target.value)}
                placeholder="https://..."
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || isScraping || !formData.productLink.trim()}
                onClick={handleScrapeByUrl}
                className="md:min-w-36"
              >
                {isScraping ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <WandSparkles className="mr-2 h-4 w-4" />
                )}
                {isScraping ? "Scraping..." : "Auto-fill"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste a vendor URL and use auto-fill to import available product data.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(event) => setField("supplier", event.target.value)}
                placeholder="Supplier name"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="supplierSku">Supplier SKU</Label>
              <Input
                id="supplierSku"
                value={formData.supplierSku}
                onChange={(event) => setField("supplierSku", event.target.value)}
                placeholder="Supplier SKU"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="sku">Internal SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(event) => setField("sku", event.target.value)}
                placeholder="SKU"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="unitPrice">Price ({currencySymbol})</Label>
              <Input
                id="unitPrice"
                type="number"
                min="0"
                step="0.01"
                value={formData.unitPrice}
                onChange={(event) => setField("unitPrice", event.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold">Specifications</h2>
          <p className="text-sm text-muted-foreground">
            Capture the practical details your team needs during planning and purchasing.
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-lg border bg-card p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="dimensions">Dimensions</Label>
              <Input
                id="dimensions"
                value={formData.dimensions}
                onChange={(event) => setField("dimensions", event.target.value)}
                placeholder="120 x 80 x 75 cm"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                min="0"
                step="0.1"
                value={formData.weight}
                onChange={(event) => setField("weight", event.target.value)}
                placeholder="0.0"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="material">Material</Label>
              <Input
                id="material"
                value={formData.material}
                onChange={(event) => setField("material", event.target.value)}
                placeholder="Wood, metal, plastic..."
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(event) => setField("color", event.target.value)}
                placeholder="White, black, natural..."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold">Tags & notes</h2>
          <p className="text-sm text-muted-foreground">
            Add shortcuts for search and any extra implementation notes for the team.
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-lg border bg-card p-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tagInput">Tags</Label>
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                id="tagInput"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="Add a tag"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={addTag} className="md:min-w-28">
                <Plus className="mr-2 h-4 w-4" />
                Add tag
              </Button>
            </div>

            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="rounded-full p-0.5 transition-colors hover:bg-black/10"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">
              Additional notes <span className="font-normal text-muted-foreground">(Optional)</span>
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(event) => setField("notes", event.target.value)}
              placeholder="Additional notes, installation guidance or procurement context..."
              rows={4}
              className="resize-none"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button asChild type="button" variant="outline">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || isScraping || isImageBusy || !formData.name.trim()}
        >
          {isSubmitting ? "Adding product..." : "Add product"}
        </Button>
      </div>
    </form>
  );
}
