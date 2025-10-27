import { supabase } from "@/integrations/supabase/client";

export class LargeBackupUploader {
  private chunkSize = 512 * 1024; // 512KB per chunk
  private uploadToken: string;
  private maxConcurrent = 3;

  constructor() {
    this.uploadToken = this.generateUploadToken();
  }

  async uploadLargeBackup(file: File, onProgress?: (progress: number) => void): Promise<string> {
    try {
      console.log(`[LargeBackupUploader] Starting upload of ${file.name} (${file.size} bytes)`);
      
      // Read file as text
      const jsonString = await file.text();
      const totalChunks = Math.ceil(jsonString.length / this.chunkSize);
      const totalSize = jsonString.length;

      console.log(`[LargeBackupUploader] Will upload ${totalChunks} chunks`);

      // Start upload session
      const { data: uploadId, error: startError } = await supabase.rpc('start_large_backup_upload', {
        p_upload_token: this.uploadToken,
        p_total_chunks: totalChunks,
        p_chunk_size: this.chunkSize,
        p_total_size: totalSize,
        p_backup_name: file.name,
        p_description: 'Backup completo con imágenes',
      });

      if (startError) throw startError;
      console.log(`[LargeBackupUploader] Upload session started: ${uploadId}`);

      // Upload chunks with concurrency control
      let completedChunks = 0;
      const chunks: Promise<void>[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const chunkPromise = this.uploadChunk(i, jsonString, totalChunks).then(() => {
          completedChunks++;
          const progress = Math.round((completedChunks / totalChunks) * 100);
          onProgress?.(progress);
        });
        
        chunks.push(chunkPromise);

        // Wait when reaching max concurrent uploads
        if (chunks.length >= this.maxConcurrent) {
          await Promise.all(chunks);
          chunks.length = 0;
        }
      }

      // Wait for remaining chunks
      if (chunks.length > 0) {
        await Promise.all(chunks);
      }

      console.log(`[LargeBackupUploader] All chunks uploaded, completing...`);

      // Complete upload and get reconstructed data
      const { data: completeData, error: completeError } = await supabase.rpc('complete_large_backup_upload', {
        p_upload_token: this.uploadToken,
      });

      if (completeError) throw completeError;

      console.log(`[LargeBackupUploader] Upload completed successfully`);
      return typeof completeData === 'string' ? completeData : JSON.stringify(completeData);

    } catch (error) {
      console.error('[LargeBackupUploader] Upload failed:', error);
      throw error;
    }
  }

  private async uploadChunk(chunkIndex: number, data: string, totalChunks: number): Promise<void> {
    const start = chunkIndex * this.chunkSize;
    const end = Math.min(start + this.chunkSize, data.length);
    const chunkData = data.slice(start, end);
    const chunkNumber = chunkIndex + 1;
    const hash = await this.calculateHash(chunkData);

    const { error } = await supabase.rpc('upload_backup_chunk', {
      p_upload_token: this.uploadToken,
      p_chunk_number: chunkNumber,
      p_chunk_data: chunkData,
      p_chunk_hash: hash,
    });

    if (error) {
      console.error(`[LargeBackupUploader] Chunk ${chunkNumber}/${totalChunks} failed:`, error);
      throw error;
    }

    console.log(`[LargeBackupUploader] Chunk ${chunkNumber}/${totalChunks} uploaded`);
  }

  async getProgress(): Promise<{
    uploadId: string;
    totalChunks: number;
    uploadedChunks: number;
    progressPercentage: number;
    status: string;
    currentChunk: number;
  } | null> {
    const { data, error } = await supabase.rpc('get_upload_progress', {
      p_upload_token: this.uploadToken,
    });

    if (error || !data || data.length === 0) return null;
    
    const progress = data[0];
    return {
      uploadId: progress.upload_id,
      totalChunks: progress.total_chunks,
      uploadedChunks: progress.uploaded_chunks,
      progressPercentage: progress.progress_percentage,
      status: progress.status,
      currentChunk: progress.current_chunk,
    };
  }

  async cancel(): Promise<boolean> {
    const { data, error } = await supabase.rpc('cancel_backup_upload', {
      p_upload_token: this.uploadToken,
    });

    if (error) return false;
    return data;
  }

  private generateUploadToken(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async calculateHash(data: string): Promise<string> {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}
