import axios from 'axios';

const GEO_API = 'https://ipapi.co';

const getGeoForIp = async (ip: string) => {
      try {
            const url = `${GEO_API}/${ip}/json/`;
            const { data } = await axios.get(url, { timeout: 5000 });
            return data;
      } catch (err) {
            return null;
      }
};

const locationService = {
      getGeoForIp,
};

export default locationService;
