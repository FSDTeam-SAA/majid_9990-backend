import mongoose from 'mongoose';
import ScanInfo from './src/modules/deviceCheck/scanInfo.model';

async function run() {
  const scanInfo = new ScanInfo({
    userId: new mongoose.Types.ObjectId(),
    deviceName: 'Test Mac',
    imei: 'LTQGCD213R',
    serviceId: 100,
    marketValue: {
        amount: 300,
    },
    aiInsight: {
        message: 'test',
    }
  });

  const error = scanInfo.validateSync();
  console.log('Validation result:', error);
  process.exit(0);
}

run();
