import mongoose from 'mongoose';
import ScanInfo from './src/modules/deviceCheck/scanInfo.model';

async function run() {
  await mongoose.connect('mongodb+srv://zihadulislambdcalling_db_user:QduYcuwg7PytLAvI@cluster0.oukqv3f.mongodb.net/majid?appName=Cluster0');
  
  const scanInfos = await ScanInfo.find({ imei: 'LTQGCD213R' }).sort({ createdAt: -1 }).limit(1).lean();
  console.log(JSON.stringify(scanInfos, null, 2));
  
  process.exit(0);
}

run();
