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
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
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
      toast.error(t("productLibrary", "invalidProductUrl"));
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
        throw new Error(payload.message || t("productLibrary", "couldNotImport"));
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

      toast.success(t("productLibrary", "importSuccess"));
    } catch (error) {
      toast.error(t("productLibrary", "couldNotImport"), {
        description: toUserFacingErrorMessage(error),
      });
    } finally {
      setIsScraping(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("productLibrary", "pleaseChooseImage"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("productLibrary", "imageMustBeSmaller"));
      return;
    }

    let fileToUpload = file;
    setIsOptimizingImage(true);

    try {
      const optimized = await optimizeCoverImageForUpload(file);
      fileToUpload = optimized.file;

      if (optimized.optimized) {
        const savedKb = Math.max(1, Math.round((optimized.originalSize - optimized.file.size) / 1024));
        toast.success(t("productLibrary", "imageOptimized"), {
          description: t("productLibrary", "reducedByKb").replace("{kb}", String(savedKb)),
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
      toast.success(t("productLibrary", "imageUploaded"));
    } catch (error) {
      toast.error(t("productLibrary", "failedUploadImage"), {
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
      toast.error(t("productLibrary", "productNameRequired"));
      return;
    }

    if (!user?.id) {
      toast.error(t("productLibrary", "userSessionNotReady"));
      return;
    }

    let normalizedProductLink: string | undefined;
    if (formData.productLink.trim()) {
      try {
        normalizedProductLink = normalizeUrl(formData.productLink);
      } catch {
        toast.error(t("productLibrary", "invalidProductUrl"));
        return;
      }
    }

    if (isImageBusy) {
      toast.error(t("productLibrary", "uploadWait"));
      return;
    }

    const parsedUnitPrice = formData.unitPrice.trim() ? Number(formData.unitPrice) : undefined;
    if (
      formData.unitPrice.trim() &&
      (typeof parsedUnitPrice !== "number" || !Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0)
    ) {
      toast.error(t("productLibrary", "validPrice"));
      return;
    }

    const parsedWeight = formData.weight.trim() ? Number(formData.weight) : undefined;
    if (
      formData.weight.trim() &&
      (typeof parsedWeight !== "number" || !Number.isFinite(parsedWeight) || parsedWeight < 0)
    ) {
      toast.error(t("productLibrary", "validWeight"));
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

      toast.success(t("productLibrary", "productAdded"));
      router.push("/organisation/product-library");
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error(t("productLibrary", "failedAddProduct"), {
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
          <h2 className="text-lg font-semibold">{t("productLibrary", "overview")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("productLibrary", "coreDetailsDescription")}
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-lg border bg-card p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t("productLibrary", "productName")}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(event) => setField("name", event.target.value)}
                placeholder="e.g. Kitchen Countertop Navona"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="category">{t("productLibrary", "category")}</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(event) => setField("category", event.target.value)}
                placeholder="e.g. Furniture, Lighting"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="brand">{t("productLibrary", "brand")}</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(event) => setField("brand", event.target.value)}
                placeholder={t("productLibrary", "brandName")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="model">{t("productLibrary", "model")}</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(event) => setField("model", event.target.value)}
                placeholder={t("productLibrary", "model")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">
              {t("productLibrary", "descriptionOptional")}
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(event) => setField("description", event.target.value)}
              placeholder={t("productLibrary", "descriptionPlaceholder")}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold">{t("productLibrary", "productImage")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("productLibrary", "productImageDescription")}
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
                ? t("productLibrary", "optimizing")
                : isUploadingImage
                  ? t("productLibrary", "uploading")
                  : t("productLibrary", "uploadImage")}
            </Button>

            {hasImage ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setField("imageUrl", "")}
                disabled={isSubmitting || isScraping || isImageBusy}
              >
                <X className="mr-2 h-4 w-4" />
                {t("productLibrary", "removeImage")}
              </Button>
            ) : null}
          </div>

          {hasImage ? (
            <div className="overflow-hidden rounded-lg border bg-secondary/70">
              <img
                src={formData.imageUrl}
                alt={t("productLibrary", "productPreview")}
                className="h-64 w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex min-h-56 items-center justify-center rounded-lg border border-dashed bg-secondary/70 px-6 text-center">
              <div className="max-w-sm flex flex-col gap-2">
                <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">{t("productLibrary", "noImageSelected")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("productLibrary", "uploadCompressed")}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="imageUrl">
              {t("productLibrary", "directImageUrl")}
            </Label>
            <Input
              id="imageUrl"
              value={formData.imageUrl}
              onChange={(event) => setField("imageUrl", event.target.value)}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground">
              {t("productLibrary", "directImageUrlHelp")}
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold">{t("productLibrary", "sourcing")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("productLibrary", "sourcingDescription")}
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-lg border bg-card p-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="productLink">{t("productLibrary", "productLink")}</Label>
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
                {isScraping ? t("productLibrary", "scraping") : t("productLibrary", "autoFill")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("productLibrary", "pasteVendorUrl")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="supplier">{t("productLibrary", "supplier")}</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(event) => setField("supplier", event.target.value)}
                placeholder={t("productLibrary", "supplierName")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="supplierSku">{t("productLibrary", "supplierSku")}</Label>
              <Input
                id="supplierSku"
                value={formData.supplierSku}
                onChange={(event) => setField("supplierSku", event.target.value)}
                placeholder={t("productLibrary", "supplierSku")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="sku">{t("productLibrary", "internalSku")}</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(event) => setField("sku", event.target.value)}
                placeholder="SKU"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="unitPrice">
                {t("productLibrary", "priceWithCurrency").replace("{currency}", currencySymbol)}
              </Label>
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
          <h2 className="text-lg font-semibold">{t("productLibrary", "specifications")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("productLibrary", "specificationsDescription")}
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-lg border bg-card p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="dimensions">{t("productLibrary", "dimensions")}</Label>
              <Input
                id="dimensions"
                value={formData.dimensions}
                onChange={(event) => setField("dimensions", event.target.value)}
                placeholder="120 x 80 x 75 cm"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="weight">{t("productLibrary", "weightKg")}</Label>
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
              <Label htmlFor="material">{t("productLibrary", "material")}</Label>
              <Input
                id="material"
                value={formData.material}
                onChange={(event) => setField("material", event.target.value)}
                placeholder={t("productLibrary", "materialPlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="color">{t("productLibrary", "color")}</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(event) => setField("color", event.target.value)}
                placeholder={t("productLibrary", "colorPlaceholder")}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold">{t("productLibrary", "tagsAndNotes")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("productLibrary", "tagsAndNotesDescription")}
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-lg border bg-card p-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tagInput">{t("productLibrary", "tags")}</Label>
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                id="tagInput"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder={t("productLibrary", "tagPlaceholder")}
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
                {t("productLibrary", "addTag")}
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
                      aria-label={t("productLibrary", "removeTag").replace("{tag}", tag)}
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
              {t("productLibrary", "additionalNotes")}
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(event) => setField("notes", event.target.value)}
              placeholder={t("productLibrary", "additionalNotesPlaceholder")}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button asChild type="button" variant="outline">
          <Link href={cancelHref}>{t("productLibrary", "cancel")}</Link>
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || isScraping || isImageBusy || !formData.name.trim()}
        >
          {isSubmitting ? t("productLibrary", "addProductSubmitting") : t("productLibrary", "addProduct")}
        </Button>
      </div>
    </form>
  );
}
