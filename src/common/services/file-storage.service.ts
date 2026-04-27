import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

export interface UploadResult {
  url: string;
  key: string;
}

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly uploadBaseDir: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.uploadBaseDir = this.configService.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'uploads');
    this.baseUrl = this.configService.get<string>('API_BASE_URL') || `http://localhost:${this.configService.get<string>('PORT') || '9000'}`;

    // Ensure base upload directory exists
    fs.mkdirSync(this.uploadBaseDir, { recursive: true });

    this.logger.log(`File storage configured: ${this.uploadBaseDir} (served at ${this.baseUrl}/uploads/)`);
  }

  /**
   * Upload a file to local filesystem
   */
  async uploadFile(
    file: Buffer,
    folder: string,
    fileName?: string,
  ): Promise<UploadResult> {
    const fileExtension = fileName ? path.extname(fileName) : '';
    const finalFileName = fileName || `${crypto.randomUUID()}${fileExtension}`;
    const dir = path.join(this.uploadBaseDir, folder);
    const filePath = path.join(dir, finalFileName);

    // Ensure directory exists
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, file);

    const key = `${folder}/${finalFileName}`;
    const url = `${this.baseUrl}/uploads/${key}`;

    this.logger.log(`File saved: ${key}`);
    return { url, key };
  }

  /**
   * Upload a product image
   */
  async uploadProductImage(file: Buffer, productId: number, originalFileName: string): Promise<UploadResult> {
    const fileExtension = path.extname(originalFileName);
    const fileName = `product-${productId}-${Date.now()}${fileExtension}`;
    return this.uploadFile(file, 'stn_assets', fileName);
  }

  /**
   * Upload an invoice PDF
   */
  async uploadInvoice(pdfBuffer: Buffer, orderId: number): Promise<UploadResult> {
    const fileName = `invoice-${orderId}-${Date.now()}.pdf`;
    return this.uploadFile(pdfBuffer, 'invoices', fileName);
  }

  /**
   * Upload an order image
   */
  async uploadOrderImage(file: Buffer, orderId: number, originalFileName: string): Promise<UploadResult> {
    const fileExtension = path.extname(originalFileName);
    const fileName = `order-${orderId}-${Date.now()}${fileExtension}`;
    return this.uploadFile(file, 'order_images', fileName);
  }

  /**
   * Delete a file from local storage
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.uploadBaseDir, key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`File deleted: ${key}`);
      }
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}:`, error);
      return false;
    }
  }

  /**
   * Get the public URL for a stored file
   */
  getFileUrl(key: string): string {
    return `${this.baseUrl}/uploads/${key}`;
  }

  /**
   * Check if a file exists
   */
  fileExists(key: string): boolean {
    const filePath = path.join(this.uploadBaseDir, key);
    return fs.existsSync(filePath);
  }
}
