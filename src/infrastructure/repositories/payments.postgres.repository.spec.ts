import { Test, TestingModule } from '@nestjs/testing';

jest.mock('typeorm', () => ({
  DataSource: class {},
  Repository: class {},
  Entity: jest.fn().mockReturnValue(jest.fn()),
  PrimaryGeneratedColumn: jest.fn().mockReturnValue(jest.fn()),
  PrimaryColumn: jest.fn().mockReturnValue(jest.fn()),
  Column: jest.fn().mockReturnValue(jest.fn()),
  CreateDateColumn: jest.fn().mockReturnValue(jest.fn()),
  UpdateDateColumn: jest.fn().mockReturnValue(jest.fn()),
  ManyToOne: jest.fn().mockReturnValue(jest.fn()),
  JoinColumn: jest.fn().mockReturnValue(jest.fn()),
  OneToMany: jest.fn().mockReturnValue(jest.fn()),
  Index: jest.fn().mockReturnValue(jest.fn()),
}));

import { DataSource, Repository } from 'typeorm';
import { PaymentRepositoryImpl } from './payments.postgres.repository';
import { PaymentEntity } from 'src/domain/entities/payments.entity';

describe('PaymentRepositoryImpl', () => {
  let repository: PaymentRepositoryImpl;
  let dataSource: DataSource;
  let typeOrmRepository: Repository<PaymentEntity>;

  const mockTypeOrmRepository = {
    save: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockTypeOrmRepository),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRepositoryImpl,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    repository = module.get<PaymentRepositoryImpl>(PaymentRepositoryImpl);
    dataSource = module.get<DataSource>(DataSource);
    typeOrmRepository = mockDataSource.getRepository(PaymentEntity);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('save', () => {
    it('should save payment entity', async () => {
      const payment = new PaymentEntity();
      await repository.save(payment);
      expect(mockTypeOrmRepository.save).toHaveBeenCalledWith(payment);
    });
  });

  describe('create', () => {
    it('should create payment from partial data', async () => {
      const partialPayment = { transaction_id: '123' } as any;
      await repository.create(partialPayment);
      expect(mockTypeOrmRepository.save).toHaveBeenCalledWith(partialPayment);
    });
  });

  describe('findByTransactionId', () => {
    it('should return payment if found', async () => {
      const payment = new PaymentEntity();
      mockTypeOrmRepository.findOneBy.mockResolvedValue(payment);

      const result = await repository.findByTransactionId('123');
      expect(mockTypeOrmRepository.findOneBy).toHaveBeenCalledWith({
        transactionId: '123',
      });
      expect(result).toBe(payment);
    });

    it('should return null if not found', async () => {
      mockTypeOrmRepository.findOneBy.mockResolvedValue(null);

      const result = await repository.findByTransactionId('123');
      expect(result).toBeNull();
    });
  });

  describe('findByReference', () => {
    it('should return payment by reference', async () => {
      const payment = new PaymentEntity();
      mockTypeOrmRepository.findOneBy.mockResolvedValue(payment);

      const result = await repository.findByReference('ref_123');
      expect(mockTypeOrmRepository.findOneBy).toHaveBeenCalledWith({
        reference: 'ref_123',
      });
      expect(result).toBe(payment);
    });
  });

  describe('markAsProcessed', () => {
    it('should update processed status', async () => {
      await repository.markAsProcessed('123');
      expect(mockTypeOrmRepository.update).toHaveBeenCalledWith(
        { transactionId: '123' },
        { processed: true },
      );
    });
  });

  describe('updateStatus', () => {
    it('should update status', async () => {
      await repository.updateStatus('123', 'completed');
      expect(mockTypeOrmRepository.update).toHaveBeenCalledWith(
        { transactionId: '123' },
        { status: 'completed' },
      );
    });
  });

  describe('update', () => {
    it('should update arbitrary fields', async () => {
      const updates = { amount: 200 };
      await repository.update('123', updates);
      expect(mockTypeOrmRepository.update).toHaveBeenCalledWith(
        { transactionId: '123' },
        updates,
      );
    });
  });

  describe('isProcessed', () => {
    it('should return true if processed is true', async () => {
      mockTypeOrmRepository.findOneBy.mockResolvedValue({ processed: true });
      const result = await repository.isProcessed('123');
      expect(result).toBe(true);
    });

    it('should return false if processed is false', async () => {
      mockTypeOrmRepository.findOneBy.mockResolvedValue({ processed: false });
      const result = await repository.isProcessed('123');
      expect(result).toBe(false);
    });

    it('should return false if payment not found', async () => {
      mockTypeOrmRepository.findOneBy.mockResolvedValue(null);
      const result = await repository.isProcessed('123');
      expect(result).toBe(false);
    });
  });
});
