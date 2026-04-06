export interface User {
  id: string
  email: string
  name?: string
}

export interface Section {
  _id: string
  name: string
  organizationId?: string
}

export interface Project {
  _id: string
  name: string
  teamId?: string
  sections: Section[]
}

export interface ShoppingSet {
  _id: string
  title: string
  sectionId?: string | null
  setType: "variant" | "bundle" | "reference"
}

export interface Team {
  _id: string
  clerkOrgId: string
  name: string
  projects: Project[]
}

export interface Product {
  name: string
  price?: string
  unitPrice?: string
  productLink?: string
  supplier?: string
  catalogNumber?: string
  dimensions?: string
  notes?: string
  quantity?: number
  imageUrl?: string
  category?: string
}

export interface ExtensionConfig {
  API_BASE: string
  MAIN_APP_URL: string
  EXTENSION_ID: string
  VERSION: string
}

export type AppView = "login" | "team" | "project" | "clipper"

export interface AppState {
  user: User | null
  teams: Team[]
  selectedTeam: Team | null
  selectedProject: Project | null
  sections: Section[]
  currentView: AppView
  isLoading: boolean
}

export interface ProductDetectionResponse {
  success: boolean
  product?: Product
  error?: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
