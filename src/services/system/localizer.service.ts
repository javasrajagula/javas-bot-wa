import prisma from '../../db/client.js';

export type LanguageCode = 'id' | 'en' | 'jawa' | 'sunda';
export type PersonaType = 'formal' | 'santai' | 'lucu' | 'islami' | 'sekolah';

interface LocalizedStrings {
  [key: string]: {
    [lang in LanguageCode]: {
      [persona in PersonaType]: string;
    };
  };
}

const DICTIONARY: LocalizedStrings = {
  welcome_default: {
    id: {
      formal: 'Selamat datang @user di grup @group. Silakan baca deskripsi grup dan patuhi peraturan yang berlaku.',
      santai: 'Halo bro @user! Selamat bergabung di @group, enjoy ya di sini!',
      lucu: 'Cieee ada member baru nih @user di @group. Jangan lupa traktirannya wkwk 🥳',
      islami: 'Assalamu\'alaikum @user, selamat bergabung di grup @group. Semoga ukhuwah kita tetap terjaga. Ahlan wa sahlan!',
      sekolah: 'Selamat datang @user di grup pembelajaran @group. Silakan perkenalkan diri Anda dengan format yang telah ditentukan.'
    },
    en: {
      formal: 'Welcome @user to the group @group. Please read the group description and follow the rules.',
      santai: 'Hey @user! Welcome to @group, have fun here!',
      lucu: 'Look who just joined! Welcome @user to @group. Don\'t forget to buy us snacks lol 🥳',
      islami: 'Assalamu\'alaikum @user, welcome to @group. May our brotherhood remain strong. Welcome!',
      sekolah: 'Welcome @user to @group learning room. Please introduce yourself using the prescribed format.'
    },
    jawa: {
      formal: 'Sugeng rawuh @user wonten ing grup @group. Mugi-mugi saged manut aturan ingkang sampun wonten.',
      santai: 'Halo lur @user! Sugeng gabung ing @group, santai wae yo!',
      lucu: 'Walah ono cah anyar iki lur @user ning @group. Ojo lali mampir tuku kopi yo wkwk 🥳',
      islami: 'Assalamu\'alaikum @user, sugeng rawuh wonten grup @group. Mugi-mugi angsal berkah saking Gusti Allah.',
      sekolah: 'Sugeng rawuh @user wonten kelas @group. Monggo tepangaken diri ngangge format ingkang sampun disiapaken.'
    },
    sunda: {
      formal: 'Wilujeng sumping @user di grup @group. Mangga aos heula pedaran grup sareng patuhi aturan anu aya.',
      santai: 'Halo kang/teh @user! Wilujeng gabung di @group, sing betah nya!',
      lucu: 'Aya anu anyar yeuh euy @user di @group. Kade tong hilap basona wkwk 🥳',
      islami: 'Assalamu\'alaikum @user, wilujeng sumping di grup @group. Mugia urang sadaya aya dina panangtayungan Allah.',
      sekolah: 'Wilujeng sumping @user di grup kelas @group. Mangga wanohkeun diri nganggo format anu parantos disayogikeun.'
    }
  },
  goodbye_default: {
    id: {
      formal: '@user telah meninggalkan grup. Terima kasih atas partisipasi dan kontribusi Anda.',
      santai: 'Dadah @user, sampai jumpa lagi ya!',
      lucu: 'Yah, @user keluar dari grup. Takut dipalak ya? wkwk bye!',
      islami: '@user telah meninggalkan grup. Semoga Allah memberikan petunjuk dan kebaikan di tempat baru.',
      sekolah: '@user telah keluar dari kelas @group. Teruskan belajar di mana saja Anda berada.'
    },
    en: {
      formal: '@user has left the group. Thank you for your participation and contribution.',
      santai: 'Goodbye @user, see you around!',
      lucu: 'Aww, @user left us. Too weak for this group? haha bye!',
      islami: '@user has left the group. May Allah bless your journey elsewhere.',
      sekolah: '@user has left the class @group. Keep learning wherever you go.'
    },
    jawa: {
      formal: '@user sampun medal saking grup. Matur nuwun sanget kaliyan kontribusi panjenengan.',
      santai: 'Dadah lur @user, mugo ketemu maneh yo!',
      lucu: 'Walah, @user lungo lur. Wedi ditagih utang yo? wkwk dadah!',
      islami: '@user sampun medal saking grup. Mugi Gusti Allah tansah paring keslametan wonten pundi mawon.',
      sekolah: '@user sampun medal saking kelas @group. Tetep sinau ing pundi wae nggih.'
    },
    sunda: {
      formal: '@user parantos kaluar ti grup. Hatur nuhun kana partisipasi sareng kontribusi salira.',
      santai: 'Pileuleuyan @user, tepang deui nya!',
      lucu: 'Aduh, @user kabur euy. Sieun ditagih hutang meureun wkwk dadah!',
      islami: '@user parantos kaluar ti grup. Mugia Allah maparinan kasalametan di tempat anu anyar.',
      sekolah: '@user parantos kaluar ti kelas @group. Sing rajin diajar di mana wae nya.'
    }
  },
  admin_only: {
    id: {
      formal: '⚠️ Maaf, perintah ini hanya dapat digunakan oleh Admin grup.',
      santai: '⚠️ Eits, cuma admin grup yang bisa pake command ini bro.',
      lucu: '⚠️ Lu bukan admin woy, ga usah sok ngatur-ngatur wkwk 😜',
      islami: '⚠️ Afwan, perintah ini khusus untuk para admin/pemimpin grup.',
      sekolah: '⚠️ Akses ditolak. Perintah ini hanya ditujukan untuk Bapak/Ibu Guru/Admin.'
    },
    en: {
      formal: '⚠️ Sorry, this command can only be used by group Admins.',
      santai: '⚠️ Dude, only admins can run this command.',
      lucu: '⚠️ You\'re not an admin, sit down and behave lol 😜',
      islami: '⚠️ Forgive us, this command is reserved for group leaders/admins.',
      sekolah: '⚠️ Access denied. This command is restricted to Teachers and class Admins.'
    },
    jawa: {
      formal: '⚠️ Nyuwun sewu, perintah puniki namung saged dipun-ginakaken dening Admin grup.',
      santai: '⚠️ Eit, mung admin grup sing iso nganggo iki lur.',
      lucu: '⚠️ Kowe dudu admin lur, ojo kakehan pola wkwk 😜',
      islami: '⚠️ Afwan, perintah puniki khusus kangge poro pemimpin/admin grup.',
      sekolah: '⚠️ Mboten saged. Perintah puniki namung kangge Bapak/Ibu Guru/Admin.'
    },
    sunda: {
      formal: '⚠️ Punten, paréntah ieu ngan tiasa dianggo ku Admin grup.',
      santai: '⚠️ Eits, ngan admin grup anu tiasa nganggo ieu euy.',
      lucu: '⚠️ Maneh lain admin euy, tong sok ngatur wkwk 😜',
      islami: '⚠️ Afwan, paréntah ieu khusus kanggo para pamingpin/admin grup.',
      sekolah: '⚠️ Teu tiasa. Paréntah ieu ngan kanggo Bapak/Ibu Guru/Admin.'
    }
  }
};

class LocalizerService {
  /**
   * Retrieves the language and persona configurations for a group
   */
  public async getGroupLocale(groupId: string): Promise<{ language: LanguageCode; persona: PersonaType }> {
    try {
      const config = await prisma.groupConfig.findUnique({
        where: { groupId }
      });
      if (!config) {
        return { language: 'id', persona: 'formal' };
      }
      const features = JSON.parse(config.featuresJson || '{}');
      const language = (features.language || 'id') as LanguageCode;
      const persona = (features.persona || 'formal') as PersonaType;
      return { language, persona };
    } catch {
      return { language: 'id', persona: 'formal' };
    }
  }

  /**
   * Formats a localized string using the group's settings and variables
   */
  public format(
    key: string,
    locale: { language: LanguageCode; persona: PersonaType },
    variables: Record<string, string> = {}
  ): string {
    const stringGroup = DICTIONARY[key];
    if (!stringGroup) {
      return `[Missing string: ${key}]`;
    }

    const langDict = stringGroup[locale.language] || stringGroup.id;
    let template = langDict[locale.persona] || langDict.formal;

    // Apply variable interpolation
    for (const [varName, varVal] of Object.entries(variables)) {
      template = template.replace(new RegExp(varName, 'g'), varVal);
    }

    return template;
  }
}

export const localizerService = new LocalizerService();
export { DICTIONARY };
