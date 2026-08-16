export interface CreateAppOptions {
  enableDocs?: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
