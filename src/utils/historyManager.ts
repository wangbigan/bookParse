// 历史记录数据类型定义
export interface HistoryRecord {
  id: string;
  bookTitle: string;
  author: string;
  filename: string;
  status: 'uploaded' | 'parsed' | 'split' | 'analyzing' | 'completed' | 'error';
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  fileSize?: number;
  chaptersCount?: number;
  analysisComplete?: boolean;
  uploadTime?: Date;
  lastAccessTime?: Date;
  coverThumbnail?: string;
  bookInfo?: any;
  resultData?: any;
  errorMessage?: string;
}

// 历史记录筛选条件
export interface HistoryFilter {
  status?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  keyword?: string;
  sortBy?: 'uploadTime' | 'lastAccessTime' | 'filename';
  sortOrder?: 'asc' | 'desc';
}

// 本地存储管理器
class HistoryManager {
  private readonly STORAGE_KEY = 'bookparse_history';
  private readonly MAX_RECORDS = 100; // 最大记录数

  // 添加新记录
  addRecord(record: HistoryRecord): void {
    try {
      const records = this.getRecords();
      
      // 添加新记录
      const newRecord = {
        ...record,
        uploadTime: record.createdAt,
        lastAccessTime: record.updatedAt
      };
      
      records.unshift(newRecord);
      
      // 限制记录数量
      if (records.length > this.MAX_RECORDS) {
        records.splice(this.MAX_RECORDS);
      }
      
      this.saveToStorage(records);
    } catch (error) {
      console.error('添加历史记录失败:', error);
    }
  }

  // 保存记录
  saveRecord(record: HistoryRecord): void {
    try {
      const records = this.getRecords();
      
      // 检查是否已存在相同记录
      const existingIndex = records.findIndex(r => r.id === record.id);
      
      if (existingIndex >= 0) {
        // 更新现有记录
        records[existingIndex] = {
          ...record,
          lastAccessTime: new Date()
        };
      } else {
        // 添加新记录
        records.unshift(record);
        
        // 限制记录数量
        if (records.length > this.MAX_RECORDS) {
          records.splice(this.MAX_RECORDS);
        }
      }
      
      this.saveToStorage(records);
    } catch (error) {
      console.error('保存历史记录失败:', error);
    }
  }

  // 获取所有记录
  getRecords(filter?: HistoryFilter): HistoryRecord[] {
    try {
      const records = this.loadFromStorage();
      
      if (!filter) {
        return records;
      }
      
      return this.filterRecords(records, filter);
    } catch (error) {
      console.error('获取历史记录失败:', error);
      return [];
    }
  }

  // 获取单个记录
  getRecord(id: string): HistoryRecord | null {
    try {
      const records = this.getRecords();
      const record = records.find(r => r.id === id);
      
      if (record) {
        // 更新最后访问时间
        this.updateRecord(id, { lastAccessTime: new Date() });
      }
      
      return record || null;
    } catch (error) {
      console.error('获取历史记录失败:', error);
      return null;
    }
  }

  // 删除记录
  deleteRecord(id: string): boolean {
    try {
      const records = this.getRecords();
      const filteredRecords = records.filter(r => r.id !== id);
      
      if (filteredRecords.length !== records.length) {
        this.saveToStorage(filteredRecords);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('删除历史记录失败:', error);
      return false;
    }
  }

  // 批量删除记录
  deleteRecords(ids: string[]): number {
    try {
      const records = this.getRecords();
      const filteredRecords = records.filter(r => !ids.includes(r.id));
      const deletedCount = records.length - filteredRecords.length;
      
      if (deletedCount > 0) {
        this.saveToStorage(filteredRecords);
      }
      
      return deletedCount;
    } catch (error) {
      console.error('批量删除历史记录失败:', error);
      return 0;
    }
  }

  // 更新记录
  updateRecord(id: string, updates: Partial<HistoryRecord>): boolean {
    try {
      const records = this.getRecords();
      const recordIndex = records.findIndex(r => r.id === id);
      
      if (recordIndex >= 0) {
        const updatedRecord = {
          ...records[recordIndex],
          ...updates,
          lastAccessTime: new Date()
        };
        
        // 确保updatedAt字段同步
        if (updates.updatedAt) {
          updatedRecord.lastAccessTime = updates.updatedAt;
        }
        
        records[recordIndex] = updatedRecord;
        
        this.saveToStorage(records);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('更新历史记录失败:', error);
      return false;
    }
  }

  // 清空所有记录
  clearAll(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('清空历史记录失败:', error);
    }
  }

  // 获取记录统计信息
  getStats(): {
    total: number;
    byStatus: Record<string, number>;
    recentCount: number;
  } {
    try {
      const records = this.getRecords();
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const byStatus: Record<string, number> = {};
      let recentCount = 0;
      
      records.forEach(record => {
        // 统计状态
        byStatus[record.status] = (byStatus[record.status] || 0) + 1;
        
        // 统计最近24小时的记录
        if (new Date(record.uploadTime) > oneDayAgo) {
          recentCount++;
        }
      });
      
      return {
        total: records.length,
        byStatus,
        recentCount
      };
    } catch (error) {
      console.error('获取统计信息失败:', error);
      return {
        total: 0,
        byStatus: {},
        recentCount: 0
      };
    }
  }

  // 从本地存储加载数据
  private loadFromStorage(): HistoryRecord[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) {
        return [];
      }
      
      const records = JSON.parse(data);
      
      // 转换日期字符串为Date对象
      return records.map((record: any) => ({
        ...record,
        uploadTime: new Date(record.uploadTime),
        lastAccessTime: new Date(record.lastAccessTime)
      }));
    } catch (error) {
      console.error('从本地存储加载数据失败:', error);
      return [];
    }
  }

  // 保存数据到本地存储
  private saveToStorage(records: HistoryRecord[]): void {
    try {
      const data = JSON.stringify(records);
      localStorage.setItem(this.STORAGE_KEY, data);
    } catch (error) {
      console.error('保存数据到本地存储失败:', error);
      
      // 如果存储空间不足，尝试清理旧记录
      if (error instanceof DOMException && error.code === 22) {
        this.cleanupOldRecords();
        
        // 重试保存
        try {
          const data = JSON.stringify(records);
          localStorage.setItem(this.STORAGE_KEY, data);
        } catch (retryError) {
          console.error('重试保存失败:', retryError);
        }
      }
    }
  }

  // 筛选记录
  private filterRecords(records: HistoryRecord[], filter: HistoryFilter): HistoryRecord[] {
    let filteredRecords = [...records];
    
    // 按状态筛选
    if (filter.status && filter.status.length > 0) {
      filteredRecords = filteredRecords.filter(record => 
        filter.status!.includes(record.status)
      );
    }
    
    // 按关键词筛选
    if (filter.keyword) {
      const keyword = filter.keyword.toLowerCase();
      filteredRecords = filteredRecords.filter(record => 
        record.filename.toLowerCase().includes(keyword) ||
        record.bookTitle?.toLowerCase().includes(keyword) ||
        record.author?.toLowerCase().includes(keyword)
      );
    }
    
    // 按日期范围筛选
    if (filter.dateRange) {
      filteredRecords = filteredRecords.filter(record => {
        const uploadTime = new Date(record.uploadTime);
        return uploadTime >= filter.dateRange!.start && 
               uploadTime <= filter.dateRange!.end;
      });
    }
    
    // 排序
    if (filter.sortBy) {
      filteredRecords.sort((a, b) => {
        const aValue = a[filter.sortBy!];
        const bValue = b[filter.sortBy!];
        
        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
        
        return filter.sortOrder === 'desc' ? -comparison : comparison;
      });
    }
    
    return filteredRecords;
  }

  // 获取最近访问的记录
  getLatestRecord(): HistoryRecord | null {
    try {
      const records = this.getRecords();
      
      if (records.length === 0) {
        return null;
      }
      
      // 按最后访问时间排序，返回最近的记录
      const sortedRecords = records.sort((a, b) => {
        const timeA = new Date(a.lastAccessTime || a.updatedAt).getTime();
        const timeB = new Date(b.lastAccessTime || b.updatedAt).getTime();
        return timeB - timeA;
      });
      
      return sortedRecords[0];
    } catch (error) {
      console.error('获取最近记录失败:', error);
      return null;
    }
  }

  // 清理旧记录
  private cleanupOldRecords(): void {
    try {
      const records = this.loadFromStorage();
      
      // 只保留最近50条记录
      const cleanedRecords = records
        .sort((a, b) => new Date(b.lastAccessTime).getTime() - new Date(a.lastAccessTime).getTime())
        .slice(0, 50);
      
      this.saveToStorage(cleanedRecords);
    } catch (error) {
      console.error('清理旧记录失败:', error);
    }
  }
}

// 导出单例实例
export const historyManager = new HistoryManager();
export default historyManager;