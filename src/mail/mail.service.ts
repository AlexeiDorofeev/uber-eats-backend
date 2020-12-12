import { Inject, Injectable } from '@nestjs/common';
import { CONFIG_OPTIONS } from 'src/common/common.constants';
import { EmailVar, MailModuleOptions } from './mail.interfaces';
import got from 'got';
import * as FormData from 'form-data';

@Injectable()
export class MailService {
  constructor(@Inject(CONFIG_OPTIONS) private readonly options: MailModuleOptions) {
    //this.sendEmail('testing', 'test');
  }
  private async sendEmail(subject: string, template: string, emailVars: EmailVar[]) {
    const form = new FormData();
    form.append('from', `Alex from Uber Eats <mailgun@${this.options.domain}>`);
    form.append('to', `dorofeev86@yahoo.com`);
    form.append('subject', subject);
    form.append('template', template);
    form.append('v:code', 'werw');
    form.append('v:username', 'alex');
    emailVars.forEach((eVar) => form.append(eVar.key, eVar.value));

    try {
      await got(`https://api.mailgun.net/v3/${this.options.domain}/messages`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${this.options.apiKey}`).toString('base64')}`,
        },
        method: 'POST',
        body: form,
      });
    } catch (error) {
      console.log(error);
    }
  }
}
