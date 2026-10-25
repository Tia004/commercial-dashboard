export const CONTACT_TYPES = ['Contatto', 'Notizia', 'Cliente effettivo'] as const;
export const CONTACT_STATUSES = ['Richiama', 'Appuntamento fissato', 'In attesa di conferma', 'Da risentire per informazioni', 'Gestisci'] as const;
export type ContactType = typeof CONTACT_TYPES[number];
export type ContactStatus = typeof CONTACT_STATUSES[number];
export interface Contact {
  id: string; company: string; person: string; email: string; phone: string;
  address: string; city: string; postalCode: string; province: string; zone: string; brand: string;
  type: ContactType; statuses: ContactStatus[]; archived: boolean;
  latitude?: number; longitude?: number;
  createdAt: string; updatedAt: string; revision: number; legacyDealIds?: string[];
}
export interface ContactActivity { id: string; contactId: string; text: string; authorName: string; createdAt: string; updatedAt: string; revision: number }
export type ContactInput = Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'revision' | 'legacyDealIds'>;
