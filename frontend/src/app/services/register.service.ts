import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import type { IRegisterRequest, IRegisterResponse } from '@app/models/register.models';

@Injectable({
  providedIn: 'root'
})
export class RegisterService {
  private readonly http = inject(HttpClient);

  register(payload: IRegisterRequest): Observable<IRegisterResponse> {
    const url = `${environment.apiBaseUrl}/api/register/`;
    return this.http.post<IRegisterResponse>(url, payload);
  }
}
