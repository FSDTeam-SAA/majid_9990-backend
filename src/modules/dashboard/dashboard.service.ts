import { User } from "../user/user.model";


const adminDashboardChart = async (query: any) => {
      const { filter = '30days' } = query;

      let startDate = new Date();
      let groupFormat = '%Y-%m-%d'; 

      // 🔹 Filter + grouping format
      if (filter === '30days') {
            startDate.setDate(startDate.getDate() - 30);
            groupFormat = '%Y-%m-%d'; // day wise
      } else if (filter === '6months') {
            startDate.setMonth(startDate.getMonth() - 6);
            groupFormat = '%Y-%m'; // month wise
      } else if (filter === '12months') {
            startDate.setFullYear(startDate.getFullYear() - 1);
            groupFormat = '%Y-%m'; // month wise
      }

      const result = await User.aggregate([
            {
                  $match: {
                        createdAt: { $gte: startDate },
                  },
            },
            {
                  $group: {
                        _id: {
                              date: {
                                    $dateToString: { format: groupFormat, date: '$createdAt' },
                              },
                              role: '$role',
                        },
                        count: { $sum: 1 },
                  },
            },
            {
                  $sort: { '_id.date': 1 },
            },
      ]);

      // 🔹 Format for chart
      const chartData: any = {};

      result.forEach((item) => {
            const date = item._id.date;
            const role = item._id.role;

            if (!chartData[date]) {
                  chartData[date] = {
                        date,
                        user: 0,
                        shopkeeper: 0,
                  };
            }

            chartData[date][role] = item.count;
      });

      return Object.values(chartData);
};


const dashboardService = {
    adminDashboardChart,
};

export default dashboardService;