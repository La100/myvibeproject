import ProductDetector from "./ProductDetector"

interface DetectionResult {
  name?: string
  nameConfidence?: number
  image?: string
  imageConfidence?: number
  description?: string
  descriptionConfidence?: number
  category?: string
  categoryConfidence?: number
  supplier?: string
  supplierConfidence?: number
  overallConfidence?: number
}

export default class UltimateProductDetector {
  private readonly debug: boolean

  constructor(debug = false) {
    this.debug = debug
  }

  async detectProduct(): Promise<DetectionResult> {
    const detector = new ProductDetector({ debug: this.debug })
    const product = await detector.detectFromPage()

    if (!product) {
      return {}
    }

    const baseConfidence = 85

    return {
      name: product.name,
      nameConfidence: baseConfidence,
      image: product.imageUrl,
      imageConfidence: product.imageUrl ? baseConfidence : 0,
      description: product.notes,
      descriptionConfidence: product.notes ? baseConfidence - 10 : 0,
      supplier: product.supplier,
      supplierConfidence: product.supplier ? baseConfidence - 5 : 0,
      overallConfidence: baseConfidence,
    }
  }
}
